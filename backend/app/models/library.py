from datetime import datetime
import enum
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .game import Game
    from .user import User


class LibraryStatus(str, enum.Enum):
    wishlist = "wishlist"
    playing = "playing"
    completed = "completed"
    abandoned = "abandoned"


class LibraryEntry(Base):
    __tablename__ = "library_entries"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    game_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("games.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[LibraryStatus] = mapped_column(
        Enum(
            LibraryStatus,
            name="library_status",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="library_entries")
    game: Mapped["Game"] = relationship("Game", back_populates="library_entries")

    __table_args__ = (
        Index("ix_library_entries_status_game_id", status, game_id),
    )
