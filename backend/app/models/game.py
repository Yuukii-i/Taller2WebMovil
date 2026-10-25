from datetime import date, datetime
from typing import TYPE_CHECKING
from sqlalchemy import (
    ARRAY,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .library import LibraryEntry
    from .review import Review

game_genres = Table(
    "game_genres",
    Base.metadata,
    Column("game_id", Integer, ForeignKey("games.id", ondelete="CASCADE"), primary_key=True),
    Column("genre_id", Integer, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
)


class Genre(Base):
    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    games: Mapped[list["Game"]] = relationship(
        "Game",
        secondary=game_genres,
        back_populates="genres",
    )


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True)
    rawg_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    background_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    platforms: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        server_default="{}",
        default=list,
        nullable=False,
    )
    rawg_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    genres: Mapped[list[Genre]] = relationship(
        Genre,
        secondary=game_genres,
        back_populates="games",
    )
    reviews: Mapped[list["Review"]] = relationship(
        "Review",
        back_populates="game",
        cascade="all, delete-orphan",
    )
    library_entries: Mapped[list["LibraryEntry"]] = relationship(
        "LibraryEntry",
        back_populates="game",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_games_title_lower", func.lower(title)),
    )
