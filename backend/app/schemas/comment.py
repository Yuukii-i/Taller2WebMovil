from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.review import Author


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)

    @field_validator("body")
    @classmethod
    def strip_and_validate_body(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Comment body cannot be blank")
        if len(stripped) > 1000:
            raise ValueError("Comment body cannot exceed 1000 characters")
        return stripped


class CommentOut(BaseModel):
    id: int
    review_id: int
    body: str
    created_at: datetime
    author: Author

    model_config = ConfigDict(from_attributes=True)


class PageCommentOut(BaseModel):
    items: list[CommentOut]
    total: int
    page: int
    page_size: int
