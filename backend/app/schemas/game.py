from datetime import date
from pydantic import BaseModel, ConfigDict


class GenreOut(BaseModel):
    id: int | None = None
    name: str
    slug: str
    game_count: int | None = None

    model_config = ConfigDict(from_attributes=True)


class GenreSimple(BaseModel):
    name: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


class StatusCounts(BaseModel):
    wishlist: int = 0
    playing: int = 0
    completed: int = 0
    abandoned: int = 0


class GameCard(BaseModel):
    id: int
    title: str
    slug: str
    cover_url: str | None
    release_date: date | None
    platforms: list[str]
    genres: list[GenreSimple]
    avg_score: float | None
    review_count: int

    model_config = ConfigDict(from_attributes=True)


class GameDetail(GameCard):
    description: str | None
    background_url: str | None
    rawg_rating: float | None
    status_counts: StatusCounts
    my_status: str | None
    my_review_id: int | None

    model_config = ConfigDict(from_attributes=True)


class PageGameCard(BaseModel):
    items: list[GameCard]
    total: int
    page: int
    page_size: int
