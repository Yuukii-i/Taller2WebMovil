from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .comment import Comment
    from .library import LibraryEntry
    from .review import Review


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    reviews: Mapped[list["Review"]] = relationship(
        "Review",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    library_entries: Mapped[list["LibraryEntry"]] = relationship(
        "LibraryEntry",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    comments: Mapped[list["Comment"]] = relationship(
        "Comment",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_users_username_lower", func.lower(username), unique=True),
        Index("ix_users_email_lower", func.lower(email), unique=True),
    )
