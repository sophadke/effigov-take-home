import json
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .db import init_db, get_session
from .models import Case, CaseCreate, CaseUpdate, CaseRead, CASE_STATUSES, utcnow


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="EffiGov Case API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: dict) -> None:
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(payload, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@app.websocket("/ws/cases")
async def cases_ws(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.post("/cases", response_model=CaseRead)
async def create_case(payload: CaseCreate, session: Session = Depends(get_session)):
    if payload.status not in CASE_STATUSES:
        raise HTTPException(400, f"status must be one of {CASE_STATUSES}")
    case = Case.model_validate(payload)
    session.add(case)
    session.commit()
    session.refresh(case)
    await manager.broadcast({"event": "case_created", "case": case.model_dump()})
    return case


@app.get("/cases", response_model=List[CaseRead])
def list_cases(status: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(Case).order_by(Case.updated_at.desc())
    if status:
        query = query.where(Case.status == status)
    return session.exec(query).all()


@app.get("/cases/lookup/by-phone", response_model=List[CaseRead])
def lookup_by_phone(phone: str, session: Session = Depends(get_session)):
    query = select(Case).where(Case.phone == phone).order_by(Case.created_at.desc())
    return session.exec(query).all()


@app.get("/cases/{case_id}", response_model=CaseRead)
def get_case(case_id: int, session: Session = Depends(get_session)):
    case = session.get(Case, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    return case


@app.patch("/cases/{case_id}", response_model=CaseRead)
async def update_case(case_id: int, payload: CaseUpdate, session: Session = Depends(get_session)):
    case = session.get(Case, case_id)
    if not case:
        raise HTTPException(404, "Case not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] not in CASE_STATUSES:
        raise HTTPException(400, f"status must be one of {CASE_STATUSES}")

    for field, value in updates.items():
        setattr(case, field, value)
    case.updated_at = utcnow()

    session.add(case)
    session.commit()
    session.refresh(case)
    await manager.broadcast({"event": "case_updated", "case": case.model_dump()})
    return case


@app.get("/health")
def health():
    return {"status": "ok"}
