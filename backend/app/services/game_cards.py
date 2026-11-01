from collections.abc import Sequence
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.game import Game
from app.models.review import Review
from app.schemas.game import GameCard, GenreSimple


def get_game_review_stats_subquery():
    return (
        select(
            Review.game_id.label("g_id"),
            func.round(func.avg(Review.score), 1).label("avg_score"),
            func.count(Review.id).label("review_count"),
        )
        .group_by(Review.game_id)
        .subquery()
    )


def build_game_cards(db: Session, game_ids: Sequence[int]) -> dict[int, GameCard]:
    if not game_ids:
        return {}

    unique_ids = list(set(game_ids))
    stats_subq = get_game_review_stats_subquery()
    avg_score_col = stats_subq.c.avg_score
    review_count_col = func.coalesce(stats_subq.c.review_count, 0)

    stmt = (
        select(Game, avg_score_col, review_count_col)
        .outerjoin(stats_subq, Game.id == stats_subq.c.g_id)
        .where(Game.id.in_(unique_ids))
        .options(selectinload(Game.genres))
    )

    rows = db.execute(stmt).all()
    cards: dict[int, GameCard] = {}
    for game, avg_score, review_count in rows:
        cards[game.id] = GameCard(
            id=game.id,
            title=game.title,
            slug=game.slug,
            cover_url=game.cover_url,
            release_date=game.release_date,
            platforms=game.platforms or [],
            genres=[GenreSimple(name=g.name, slug=g.slug) for g in game.genres],
            avg_score=float(avg_score) if avg_score is not None else None,
            review_count=int(review_count or 0),
        )
    return cards
