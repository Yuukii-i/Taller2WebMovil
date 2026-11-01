from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.comment import Comment
from app.models.game import Game
from app.models.review import Review
from app.models.user import User
from app.schemas.review import (
    Author,
    PageReviewOut,
    PageReviewWithGame,
    ReviewIn,
    ReviewOut,
    ReviewWithGame,
)
from app.services.game_cards import build_game_cards

router = APIRouter(tags=["reviews"])


def _get_comment_counts_subquery():
    return (
        select(
            Comment.review_id.label("r_id"),
            func.count(Comment.id).label("comment_count"),
        )
        .group_by(Comment.review_id)
        .subquery()
    )


@router.get("/games/{id}/reviews", response_model=PageReviewOut)
def list_game_reviews(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    sort: Literal["latest", "top"] = "latest",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> PageReviewOut:
    game_exists = db.scalar(select(Game.id).where(Game.id == id))
    if not game_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )

    total = db.scalar(
        select(func.count(Review.id)).where(Review.game_id == id)
    ) or 0

    comments_subq = _get_comment_counts_subquery()
    comment_count_col = func.coalesce(comments_subq.c.comment_count, 0)

    if sort == "top":
        order_clauses = [
            Review.score.desc(),
            comment_count_col.desc(),
            Review.created_at.desc(),
            Review.id.desc(),
        ]
    else:  # latest
        order_clauses = [Review.created_at.desc(), Review.id.desc()]

    stmt = (
        select(Review, User.username, comment_count_col)
        .join(User, Review.user_id == User.id)
        .outerjoin(comments_subq, Review.id == comments_subq.c.r_id)
        .where(Review.game_id == id)
        .order_by(*order_clauses)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = db.execute(stmt).all()
    items = [
        ReviewOut(
            id=review.id,
            game_id=review.game_id,
            score=review.score,
            body=review.body,
            created_at=review.created_at,
            updated_at=review.updated_at,
            author=Author(id=review.user_id, username=username),
            comment_count=int(comment_count),
        )
        for review, username, comment_count in rows
    ]

    return PageReviewOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/games/{id}/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_game_review(
    id: int,
    payload: ReviewIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReviewOut:
    game_exists = db.scalar(select(Game.id).where(Game.id == id))
    if not game_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )

    existing = db.scalar(
        select(Review.id).where(
            Review.game_id == id,
            Review.user_id == current_user.id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="you already reviewed this game",
        )

    review = Review(
        user_id=current_user.id,
        game_id=id,
        score=payload.score,
        body=payload.body,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="you already reviewed this game",
        )

    db.refresh(review)
    return ReviewOut(
        id=review.id,
        game_id=review.game_id,
        score=review.score,
        body=review.body,
        created_at=review.created_at,
        updated_at=review.updated_at,
        author=Author(id=current_user.id, username=current_user.username),
        comment_count=0,
    )


@router.get("/reviews/{id}", response_model=ReviewWithGame)
def get_review_detail(
    id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ReviewWithGame:
    comments_subq = _get_comment_counts_subquery()
    comment_count_col = func.coalesce(comments_subq.c.comment_count, 0)

    stmt = (
        select(Review, User.username, comment_count_col)
        .join(User, Review.user_id == User.id)
        .outerjoin(comments_subq, Review.id == comments_subq.c.r_id)
        .where(Review.id == id)
    )
    row = db.execute(stmt).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    review, username, comment_count = row
    cards = build_game_cards(db, [review.game_id])
    if review.game_id not in cards:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )

    return ReviewWithGame(
        id=review.id,
        game_id=review.game_id,
        score=review.score,
        body=review.body,
        created_at=review.created_at,
        updated_at=review.updated_at,
        author=Author(id=review.user_id, username=username),
        comment_count=int(comment_count),
        game=cards[review.game_id],
    )


@router.put("/reviews/{id}", response_model=ReviewOut)
def update_review(
    id: int,
    payload: ReviewIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReviewOut:
    review = db.get(Review, id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the author of this review",
        )

    review.score = payload.score
    review.body = payload.body
    review.updated_at = func.now()
    db.commit()
    db.refresh(review)

    comment_count = db.scalar(
        select(func.count(Comment.id)).where(Comment.review_id == id)
    ) or 0

    return ReviewOut(
        id=review.id,
        game_id=review.game_id,
        score=review.score,
        body=review.body,
        created_at=review.created_at,
        updated_at=review.updated_at,
        author=Author(id=current_user.id, username=current_user.username),
        comment_count=int(comment_count),
    )


@router.delete("/reviews/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    review = db.get(Review, id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the author of this review",
        )

    db.delete(review)
    db.commit()
    return None


@router.get("/users/{username}/reviews", response_model=PageReviewWithGame)
def get_user_reviews(
    username: str,
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> PageReviewWithGame:
    user = db.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    total = db.scalar(
        select(func.count(Review.id)).where(Review.user_id == user.id)
    ) or 0

    comments_subq = _get_comment_counts_subquery()
    comment_count_col = func.coalesce(comments_subq.c.comment_count, 0)

    stmt = (
        select(Review, comment_count_col)
        .outerjoin(comments_subq, Review.id == comments_subq.c.r_id)
        .where(Review.user_id == user.id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = db.execute(stmt).all()
    game_ids = [r[0].game_id for r in rows]
    cards = build_game_cards(db, game_ids)

    items = [
        ReviewWithGame(
            id=review.id,
            game_id=review.game_id,
            score=review.score,
            body=review.body,
            created_at=review.created_at,
            updated_at=review.updated_at,
            author=Author(id=user.id, username=user.username),
            comment_count=int(comment_count),
            game=cards[review.game_id],
        )
        for review, comment_count in rows
        if review.game_id in cards
    ]

    return PageReviewWithGame(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
