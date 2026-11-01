from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import HOME_MIN_REVIEWS
from app.db import get_db
from app.models.comment import Comment
from app.models.library import LibraryEntry, LibraryStatus
from app.models.review import Review
from app.models.user import User
from app.schemas.home import GameCountItem, HomeOut, TopRatedGameItem
from app.schemas.review import Author, ReviewWithGame
from app.services.game_cards import build_game_cards

router = APIRouter(tags=["home"])


def _get_library_status_list(db: Session, status: LibraryStatus) -> list[tuple[int, int]]:
    count_col = func.count(LibraryEntry.user_id).label("status_count")
    stmt = (
        select(LibraryEntry.game_id, count_col)
        .where(LibraryEntry.status == status)
        .group_by(LibraryEntry.game_id)
        .having(count_col > 0)
        .order_by(count_col.desc(), LibraryEntry.game_id.asc())
        .limit(10)
    )
    return [(row[0], int(row[1])) for row in db.execute(stmt).all()]


def _get_top_rated_list(db: Session) -> list[tuple[int, float, int]]:
    avg_col = func.round(func.avg(Review.score), 1).label("avg_score")
    count_col = func.count(Review.id).label("review_count")
    stmt = (
        select(Review.game_id, avg_col, count_col)
        .group_by(Review.game_id)
        .having(count_col >= HOME_MIN_REVIEWS)
        .order_by(avg_col.desc(), count_col.desc(), Review.game_id.asc())
        .limit(10)
    )
    return [(row[0], float(row[1]), int(row[2])) for row in db.execute(stmt).all()]


def _get_recent_reviews(db: Session) -> list[tuple[Review, str, int]]:
    comments_subq = (
        select(
            Comment.review_id.label("r_id"),
            func.count(Comment.id).label("comment_count"),
        )
        .group_by(Comment.review_id)
        .subquery()
    )
    comment_count_col = func.coalesce(comments_subq.c.comment_count, 0)

    stmt = (
        select(Review, User.username, comment_count_col)
        .join(User, Review.user_id == User.id)
        .outerjoin(comments_subq, Review.id == comments_subq.c.r_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(10)
    )
    return [(row[0], row[1], int(row[2])) for row in db.execute(stmt).all()]


@router.get("/home", response_model=HomeOut)
def get_home_data(db: Annotated[Session, Depends(get_db)]) -> HomeOut:
    wishlisted_data = _get_library_status_list(db, LibraryStatus.wishlist)
    abandoned_data = _get_library_status_list(db, LibraryStatus.abandoned)
    playing_data = _get_library_status_list(db, LibraryStatus.playing)
    completed_data = _get_library_status_list(db, LibraryStatus.completed)
    top_rated_data = _get_top_rated_list(db)
    recent_reviews_data = _get_recent_reviews(db)

    # Collect all game IDs across all 6 sections for ONE batched build_game_cards call
    all_game_ids: set[int] = set()
    for g_id, _ in wishlisted_data:
        all_game_ids.add(g_id)
    for g_id, _ in abandoned_data:
        all_game_ids.add(g_id)
    for g_id, _ in playing_data:
        all_game_ids.add(g_id)
    for g_id, _ in completed_data:
        all_game_ids.add(g_id)
    for g_id, _, _ in top_rated_data:
        all_game_ids.add(g_id)
    for rev, _, _ in recent_reviews_data:
        all_game_ids.add(rev.game_id)

    cards = build_game_cards(db, list(all_game_ids))

    def make_count_items(data: list[tuple[int, int]]) -> list[GameCountItem]:
        return [
            GameCountItem(game=cards[g_id], count=cnt)
            for g_id, cnt in data
            if g_id in cards
        ]

    top_rated_items = [
        TopRatedGameItem(game=cards[g_id], avg_score=avg, review_count=cnt)
        for g_id, avg, cnt in top_rated_data
        if g_id in cards
    ]

    recent_review_items = [
        ReviewWithGame(
            id=rev.id,
            game_id=rev.game_id,
            score=rev.score,
            body=rev.body,
            created_at=rev.created_at,
            updated_at=rev.updated_at,
            author=Author(id=rev.user_id, username=username),
            comment_count=comment_count,
            game=cards[rev.game_id],
        )
        for rev, username, comment_count in recent_reviews_data
        if rev.game_id in cards
    ]

    return HomeOut(
        most_wishlisted=make_count_items(wishlisted_data),
        most_abandoned=make_count_items(abandoned_data),
        most_playing=make_count_items(playing_data),
        most_completed=make_count_items(completed_data),
        top_rated=top_rated_items,
        recent_reviews=recent_review_items,
    )
