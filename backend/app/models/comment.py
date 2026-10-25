from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .review import Review
    from .user import User


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("reviews.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    review: Mapped["Review"] = relationship("Review", back_populates="comments")
    user: Mapped["User"] = relationship("User", back_populates="comments")

    __table_args__ = (
        Index("ix_comments_review_id_created_at", review_id, created_at),
    )
