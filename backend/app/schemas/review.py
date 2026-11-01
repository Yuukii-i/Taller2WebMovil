from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.game import GameCard


class Author(BaseModel):
    id: int
    username: str

    model_config = ConfigDict(from_attributes=True)


class ReviewIn(BaseModel):
    score: int = Field(ge=1, le=10)
    body: str | None = Field(default=None, max_length=5000)

    @field_validator("body")
    @classmethod
    def clean_body(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None


class ReviewOut(BaseModel):
    id: int
    game_id: int
    score: int
    body: str | None
    created_at: datetime
    updated_at: datetime
    author: Author
    comment_count: int

    model_config = ConfigDict(from_attributes=True)


class ReviewWithGame(ReviewOut):
    game: GameCard


class PageReviewOut(BaseModel):
    items: list[ReviewOut]
    total: int
    page: int
    page_size: int


class PageReviewWithGame(BaseModel):
    items: list[ReviewWithGame]
    total: int
    page: int
    page_size: int
