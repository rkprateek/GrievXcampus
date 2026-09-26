from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class RoleName(str, Enum):
    STUDENT = "student"
    STAFF = "staff"
    DEPARTMENT_HEAD = "department_head"
    ADMIN = "admin"


class Role(TimestampMixin, Base):
    __tablename__ = "roles"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    users: Mapped[list["User"]] = relationship(back_populates="role")
