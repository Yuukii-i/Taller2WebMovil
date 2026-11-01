from datetime import datetime, timezone, timedelta
import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.config import settings

_pwd_hash = PasswordHash((Argon2Hasher(),))
DUMMY_HASH = _pwd_hash.hash("dummy_password_for_timing")


def hash_password(password: str) -> str:
    return _pwd_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _pwd_hash.verify(plain_password, hashed_password)


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_expire_min)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        sub = payload.get("sub")
        if sub is None:
            raise ValueError("Token missing subject")
        return int(sub)
    except (jwt.PyJWTError, ValueError) as e:
        raise ValueError("Invalid token") from e
