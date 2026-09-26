import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    tasks: Mapped[List["Task"]] = relationship(
        "Task", back_populates="current_agent", lazy="selectin"
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "role": self.role,
            "is_active": self.is_active,
        }


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="received"
    )  # received | routed | in_progress | blocked | handoff | completed
    current_agent_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("agents.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    current_agent: Mapped[Optional[Agent]] = relationship(
        "Agent", back_populates="tasks", lazy="selectin"
    )
    events: Mapped[List["TaskEvent"]] = relationship(
        "TaskEvent",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskEvent.sequence_no.asc()",
        lazy="selectin",
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "description": self.description,
            "status": self.status,
            "current_agent_id": self.current_agent_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
        }


class TaskEvent(Base):
    __tablename__ = "task_events"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # task.created | task.routed | task.handoff | task.blocked | task.completed
    from_agent_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    to_agent_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[Dict[str, Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    task: Mapped[Task] = relationship("Task", back_populates="events")

    __table_args__ = (
        UniqueConstraint("task_id", "sequence_no", name="uq_task_events_task_seq"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "task_id": str(self.task_id),
            "sequence_no": self.sequence_no,
            "event_type": self.event_type,
            "from_agent_id": self.from_agent_id,
            "to_agent_id": self.to_agent_id,
            "reason": self.reason,
            "payload": self.payload,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
