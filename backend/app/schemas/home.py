from pydantic import BaseModel

from app.schemas.game import GameCard
from app.schemas.review import ReviewWithGame


class GameCountItem(BaseModel):
    game: GameCard
    count: int


class TopRatedGameItem(BaseModel):
    game: GameCard
    avg_score: float
    review_count: int


class HomeOut(BaseModel):
    most_wishlisted: list[GameCountItem]
    most_abandoned: list[GameCountItem]
    most_playing: list[GameCountItem]
    most_completed: list[GameCountItem]
    top_rated: list[TopRatedGameItem]
    recent_reviews: list[ReviewWithGame]
