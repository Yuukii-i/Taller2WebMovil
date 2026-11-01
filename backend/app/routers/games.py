import logging
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, nullslast, select, any_
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import get_optional_user
from app.models.game import Game, Genre, game_genres
from app.models.library import LibraryEntry
from app.models.review import Review
from app.models.user import User
from app.schemas.game import GameCard, GameDetail, GenreSimple, PageGameCard, StatusCounts
from app.services.game_import import ensure_description, upsert_games
from app.services.rawg import RawgError, search_games

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/games", tags=["games"])


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=PageGameCard)
def list_games(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = None,
    genre: str | None = None,
    platform: str | None = None,
    sort: Literal["rating", "title", "release", "reviews"] = "rating",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> PageGameCard:
    cleaned_q = q.strip() if q else ""

    # Check local count for RAWG fill condition
    if cleaned_q and page == 1:
        escaped_q = _escape_like(cleaned_q)
        local_q_count = db.scalar(
            select(func.count(Game.id)).where(Game.title.ilike(f"%{escaped_q}%", escape="\\"))
        ) or 0
        if local_q_count < 5:
            try:
                rawg_results = search_games(cleaned_q)
                upsert_games(db, rawg_results)
            except RawgError as e:
                logger.warning("RAWG search failed for q=%s: %s", cleaned_q, e)

    # Base query filters
    conditions = []
    if cleaned_q:
        escaped_q = _escape_like(cleaned_q)
        conditions.append(Game.title.ilike(f"%{escaped_q}%", escape="\\"))

    if genre:
        conditions.append(
            Game.id.in_(
                select(game_genres.c.game_id)
                .join(Genre, Genre.id == game_genres.c.genre_id)
                .where(Genre.slug == genre.strip())
            )
        )

    if platform:
        conditions.append(platform.strip() == any_(Game.platforms))

    total = db.scalar(
        select(func.count(Game.id)).where(*conditions)
    ) or 0

    # Review stats subquery grouped by game_id
    stats_subq = (
        select(
            Review.game_id.label("g_id"),
            func.round(func.avg(Review.score), 1).label("avg_score"),
            func.count(Review.id).label("review_count"),
        )
        .group_by(Review.game_id)
        .subquery()
    )

    avg_score_col = stats_subq.c.avg_score
    review_count_col = func.coalesce(stats_subq.c.review_count, 0)

    # Sorting
    if sort == "title":
        order_clauses = [func.lower(Game.title).asc(), Game.id.asc()]
    elif sort == "release":
        order_clauses = [nullslast(Game.release_date.desc()), Game.id.asc()]
    elif sort == "reviews":
        order_clauses = [review_count_col.desc(), Game.id.asc()]
    else:  # rating (default)
        order_clauses = [nullslast(Game.rawg_rating.desc()), Game.id.asc()]

    query = (
        select(Game, avg_score_col, review_count_col)
        .outerjoin(stats_subq, Game.id == stats_subq.c.g_id)
        .where(*conditions)
        .order_by(*order_clauses)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(selectinload(Game.genres))
    )

    rows = db.execute(query).all()

    items = [
        GameCard(
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
        for game, avg_score, review_count in rows
    ]

    return PageGameCard(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=GameDetail)
def get_game_detail(
    id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_optional_user)],
) -> GameDetail:
    game = db.scalar(
        select(Game).where(Game.id == id).options(selectinload(Game.genres))
    )
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )

    # Lazy fetch description if missing
    ensure_description(db, game)

    # Review stats
    stats_row = db.execute(
        select(
            func.round(func.avg(Review.score), 1),
            func.count(Review.id),
        ).where(Review.game_id == id)
    ).one()
    avg_score = float(stats_row[0]) if stats_row[0] is not None else None
    review_count = int(stats_row[1] or 0)

    # Status counts
    counts_rows = db.execute(
        select(LibraryEntry.status, func.count(LibraryEntry.user_id))
        .where(LibraryEntry.game_id == id)
        .group_by(LibraryEntry.status)
    ).all()
    status_map = {"wishlist": 0, "playing": 0, "completed": 0, "abandoned": 0}
    for entry_status, count in counts_rows:
        val = entry_status.value if hasattr(entry_status, "value") else str(entry_status)
        if val in status_map:
            status_map[val] = count

    # User context
    my_status: str | None = None
    my_review_id: int | None = None
    if current_user:
        lib_entry = db.scalar(
            select(LibraryEntry.status).where(
                LibraryEntry.game_id == id,
                LibraryEntry.user_id == current_user.id,
            )
        )
        if lib_entry:
            my_status = lib_entry.value if hasattr(lib_entry, "value") else str(lib_entry)

        rev_id = db.scalar(
            select(Review.id).where(
                Review.game_id == id,
                Review.user_id == current_user.id,
            )
        )
        if rev_id:
            my_review_id = rev_id

    return GameDetail(
        id=game.id,
        title=game.title,
        slug=game.slug,
        cover_url=game.cover_url,
        background_url=game.background_url,
        description=game.description,
        release_date=game.release_date,
        platforms=game.platforms or [],
        rawg_rating=game.rawg_rating,
        genres=[GenreSimple(name=g.name, slug=g.slug) for g in game.genres],
        avg_score=avg_score,
        review_count=review_count,
        status_counts=StatusCounts(**status_map),
        my_status=my_status,
        my_review_id=my_review_id,
    )
