from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.library import LibraryEntry
from app.models.review import Review
from app.models.user import User
from app.schemas.user import LibraryCounts, UserOut, UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


@router.get("/{username}", response_model=UserPublic)
def get_user_profile(username: str, db: Annotated[Session, Depends(get_db)]) -> UserPublic:
    user = db.scalar(
        select(User).where(func.lower(User.username) == username.lower())
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    review_count = db.scalar(
        select(func.count(Review.id)).where(Review.user_id == user.id)
    ) or 0

    status_counts_rows = db.execute(
        select(LibraryEntry.status, func.count(LibraryEntry.game_id))
        .where(LibraryEntry.user_id == user.id)
        .group_by(LibraryEntry.status)
    ).all()

    counts_dict = {
        "wishlist": 0,
        "playing": 0,
        "completed": 0,
        "abandoned": 0,
    }
    for entry_status, count in status_counts_rows:
        val = entry_status.value if hasattr(entry_status, "value") else str(entry_status)
        if val in counts_dict:
            counts_dict[val] = count

    return UserPublic(
        id=user.id,
        username=user.username,
        created_at=user.created_at,
        review_count=review_count,
        library_counts=LibraryCounts(**counts_dict),
    )
