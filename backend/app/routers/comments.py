from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.comment import Comment
from app.models.review import Review
from app.models.user import User
from app.schemas.comment import CommentIn, CommentOut, PageCommentOut
from app.schemas.review import Author

router = APIRouter(tags=["comments"])


@router.get("/reviews/{id}/comments", response_model=PageCommentOut)
def list_review_comments(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> PageCommentOut:
    review_exists = db.scalar(select(Review.id).where(Review.id == id))
    if not review_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    total = db.scalar(
        select(func.count(Comment.id)).where(Comment.review_id == id)
    ) or 0

    stmt = (
        select(Comment, User.username)
        .join(User, Comment.user_id == User.id)
        .where(Comment.review_id == id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = db.execute(stmt).all()
    items = [
        CommentOut(
            id=comment.id,
            review_id=comment.review_id,
            body=comment.body,
            created_at=comment.created_at,
            author=Author(id=comment.user_id, username=username),
        )
        for comment, username in rows
    ]

    return PageCommentOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/reviews/{id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_review_comment(
    id: int,
    payload: CommentIn,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CommentOut:
    review_exists = db.scalar(select(Review.id).where(Review.id == id))
    if not review_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    comment = Comment(
        review_id=id,
        user_id=current_user.id,
        body=payload.body,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentOut(
        id=comment.id,
        review_id=comment.review_id,
        body=comment.body,
        created_at=comment.created_at,
        author=Author(id=current_user.id, username=current_user.username),
    )


@router.delete("/comments/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    comment = db.get(Comment, id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    review = db.get(Review, comment.review_id)
    # Allowed if current_user is the comment author OR review author
    is_comment_author = comment.user_id == current_user.id
    is_review_author = review is not None and review.user_id == current_user.id

    if not (is_comment_author or is_review_author):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this comment",
        )

    db.delete(comment)
    db.commit()
    return None
