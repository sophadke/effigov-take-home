from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field

CASE_STATUSES = ("open", "in_progress", "resolved")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CaseBase(SQLModel):
    name: str
    phone: str
    issue_type: str
    description: str
    status: str = Field(default="open")
    notes: Optional[str] = None


class Case(CaseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class CaseCreate(SQLModel):
    name: str
    phone: str
    issue_type: str
    description: str
    status: str = "open"
    notes: Optional[str] = None


class CaseUpdate(SQLModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    issue_type: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class CaseRead(CaseBase):
    id: int
    created_at: datetime
    updated_at: datetime
