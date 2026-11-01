from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.library import LibraryStatus
from app.schemas.game import GameCard


class LibraryStatusUpdate(BaseModel):
    status: LibraryStatus


class LibraryEntryOut(BaseModel):
    game_id: int
    status: LibraryStatus
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserLibraryItem(BaseModel):
    game: GameCard
    status: LibraryStatus
    updated_at: datetime


class PageUserLibraryItem(BaseModel):
    items: list[UserLibraryItem]
    total: int
    page: int
    page_size: int
