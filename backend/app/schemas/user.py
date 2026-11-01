from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    username: str = Field(pattern=r"^[a-z0-9_]{3,20}$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower()


class LoginIn(BaseModel):
    identifier: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LibraryCounts(BaseModel):
    wishlist: int = 0
    playing: int = 0
    completed: int = 0
    abandoned: int = 0


class UserPublic(BaseModel):
    id: int
    username: str
    created_at: datetime
    review_count: int
    library_counts: LibraryCounts

    model_config = ConfigDict(from_attributes=True)
