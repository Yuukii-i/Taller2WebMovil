from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.game import Genre, game_genres
from app.schemas.game import GenreOut

router = APIRouter(prefix="/genres", tags=["genres"])


@router.get("", response_model=list[GenreOut])
def list_genres(db: Annotated[Session, Depends(get_db)]) -> list[GenreOut]:
    count_col = func.count(game_genres.c.game_id).label("game_count")
    stmt = (
        select(Genre.id, Genre.name, Genre.slug, count_col)
        .join(game_genres, Genre.id == game_genres.c.genre_id)
        .group_by(Genre.id)
        .having(count_col >= 1)
        .order_by(count_col.desc(), Genre.name.asc())
    )
    rows = db.execute(stmt).all()
    return [
        GenreOut(id=row.id, name=row.name, slug=row.slug, game_count=row.game_count)
        for row in rows
    ]
