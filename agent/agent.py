"""
EffiGov take-home voice agent.

Narrow, intentional scope (per the take-home's own advice to pick one
workflow and make it work end to end):

  A resident calls in and can either:
    1. Report a new issue -> agent collects name, phone, issue type,
       description, then calls the backend to create a case.
    2. Ask for an update on an existing case -> agent looks the case up by
       phone number and reads back the status.

Architecture:
  LiveKit room audio <-> AgentSession (VAD + STT + LLM + TTS) <-> Agent
  The Agent's @function_tool methods are the "at least one backend action"
  requirement: they call the FastAPI backend over HTTP so the LLM can
  create/read case data as part of the conversation.
"""
import logging
import os

import httpx
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import deepgram, openai, silero

load_dotenv()

logger = logging.getLogger("effigov-agent")

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
VALID_ISSUE_TYPES = ("missed_pickup", "billing", "damaged_property", "other")


class IntakeAgent(Agent):
    """A resident-services intake agent for EffiGov."""

    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are EffiGov's phone assistant for a local government "
                "resident services line. You are warm, efficient, and speak "
                "in short sentences suited for a phone call (no lists, no "
                "markdown). You can do two things: (1) file a new service "
                "issue, or (2) give a status update on an existing case by "
                "phone number.\n\n"
                "For a NEW issue, collect, one at a time: the resident's "
                f"name, phone number, issue type (one of {VALID_ISSUE_TYPES}, "
                "map their own words onto the closest one), and a short "
                "description. Confirm the details back to them briefly, "
                "then call create_case. After it succeeds, tell them their "
                "case number and that someone will follow up.\n\n"
                "For a STATUS check, ask for their phone number and call "
                "lookup_case_by_phone. Read back the status and any notes "
                "in plain language. If there's no case, say so and offer to "
                "file a new one.\n\n"
                "Never invent a case number or status — only report what "
                "the tools return."
            )
        )
        self._http = httpx.AsyncClient(base_url=BACKEND_URL, timeout=10.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    @function_tool
    async def create_case(
        self,
        context: RunContext,
        name: str,
        phone: str,
        issue_type: str,
        description: str,
    ) -> str:
        """Create a new service case once name, phone, issue type, and a
        description have all been collected and confirmed with the caller.

        Args:
            name: The resident's full name.
            phone: The resident's callback phone number.
            issue_type: One of missed_pickup, billing, damaged_property, other.
            description: A short summary of the issue in the resident's words.
        """
        if issue_type not in VALID_ISSUE_TYPES:
            issue_type = "other"
        try:
            resp = await self._http.post(
                "/cases",
                json={
                    "name": name,
                    "phone": phone,
                    "issue_type": issue_type,
                    "description": description,
                },
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("create_case failed: %s", e)
            return "Sorry, I'm having trouble reaching the case system right now."
        case = resp.json()
        logger.info("created case %s", case["id"])
        return f"Case #{case['id']} created with status {case['status']}."

    @function_tool
    async def lookup_case_by_phone(self, context: RunContext, phone: str) -> str:
        """Look up the most recent case for a resident by phone number.

        Args:
            phone: The phone number the caller wants looked up.
        """
        try:
            resp = await self._http.get(
                "/cases/lookup/by-phone", params={"phone": phone}
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("lookup_case_by_phone failed: %s", e)
            return "Sorry, I'm having trouble reaching the case system right now."
        cases = resp.json()
        if not cases:
            return "No case was found for that phone number."
        case = cases[0]
        notes = f" Notes: {case['notes']}." if case.get("notes") else ""
        return (
            f"Case #{case['id']} for {case['name']}, issue type "
            f"{case['issue_type']}, is currently {case['status']}.{notes}"
        )

    @function_tool
    async def update_case_status(
        self, context: RunContext, case_id: int, status: str
    ) -> str:
        """Update the status of an existing case. Only use this if the
        caller (e.g. a staff member testing the line) explicitly asks to
        change a case's status.

        Args:
            case_id: The numeric case id.
            status: One of open, in_progress, resolved.
        """
        # Validate before the call so a bad LLM-generated status becomes a
        # spoken correction instead of an unhandled HTTP error mid-call.
        if status not in ("open", "in_progress", "resolved"):
            return (
                f"'{status}' isn't a valid status. Please use one of: "
                "open, in_progress, resolved."
            )
        try:
            resp = await self._http.patch(f"/cases/{case_id}", json={"status": status})
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return f"I couldn't find case #{case_id}."
            logger.warning("update_case_status failed: %s", e.response.text)
            return "Sorry, I wasn't able to update that case right now."
        except httpx.HTTPError as e:
            logger.warning("update_case_status connection error: %s", e)
            return "Sorry, I'm having trouble reaching the case system right now."
        case = resp.json()
        return f"Case #{case['id']} updated to {case['status']}."


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=openai.TTS(voice="alloy"),
    )

    agent = IntakeAgent()
    await session.start(agent=agent, room=ctx.room)
    await session.generate_reply(
        instructions=(
            "Greet the caller as EffiGov resident services, and ask whether "
            "they'd like to report an issue or check on an existing case."
        )
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
