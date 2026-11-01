from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.game import Game
from app.models.library import LibraryEntry, LibraryStatus
from app.models.user import User
from app.schemas.library import (
    LibraryEntryOut,
    LibraryStatusUpdate,
    PageUserLibraryItem,
    UserLibraryItem,
)
from app.services.game_cards import build_game_cards

router = APIRouter(tags=["library"])


@router.put("/library/{game_id}", response_model=LibraryEntryOut)
def upsert_library_entry(
    game_id: int,
    payload: LibraryStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> LibraryEntryOut:
    game_exists = db.scalar(select(Game.id).where(Game.id == game_id))
    if not game_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )

    entry = db.get(LibraryEntry, (current_user.id, game_id))
    if entry:
        entry.status = payload.status
        entry.updated_at = func.now()
    else:
        entry = LibraryEntry(
            user_id=current_user.id,
            game_id=game_id,
            status=payload.status,
        )
        db.add(entry)

    db.commit()
    db.refresh(entry)
    return LibraryEntryOut(
        game_id=entry.game_id,
        status=entry.status,
        updated_at=entry.updated_at,
    )


@router.delete("/library/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_library_entry(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    entry = db.get(LibraryEntry, (current_user.id, game_id))
    if entry:
        db.delete(entry)
        db.commit()
    return None


@router.get("/users/{username}/library", response_model=PageUserLibraryItem)
def get_user_library(
    username: str,
    db: Annotated[Session, Depends(get_db)],
    entry_status: LibraryStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> PageUserLibraryItem:
    user = db.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    conditions = [LibraryEntry.user_id == user.id]
    if entry_status is not None:
        conditions.append(LibraryEntry.status == entry_status)

    total = db.scalar(
        select(func.count()).select_from(LibraryEntry).where(*conditions)
    ) or 0

    entries_stmt = (
        select(LibraryEntry)
        .where(*conditions)
        .order_by(LibraryEntry.updated_at.desc(), LibraryEntry.game_id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    entries = db.scalars(entries_stmt).all()

    game_ids = [e.game_id for e in entries]
    cards = build_game_cards(db, game_ids)

    items = [
        UserLibraryItem(
            game=cards[e.game_id],
            status=e.status,
            updated_at=e.updated_at,
        )
        for e in entries
        if e.game_id in cards
    ]

    return PageUserLibraryItem(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
