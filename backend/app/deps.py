from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.services.security import decode_token

http_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not creds or not creds.credentials:
        raise unauthorized

    try:
        user_id = decode_token(creds.credentials)
    except ValueError:
        raise unauthorized

    user = db.get(User, user_id)
    if not user:
        raise unauthorized
    return user


def get_optional_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User | None:
    if not creds or not creds.credentials:
        return None
    try:
        user_id = decode_token(creds.credentials)
    except ValueError:
        return None
    return db.get(User, user_id)
