import sys
from pathlib import Path
from collections.abc import Generator
from urllib.parse import urlparse, urlunparse

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.db import get_db
from app.main import app
from app.models.base import Base


def _get_test_db_url() -> tuple[str, str]:
    parsed = urlparse(settings.database_url)
    path = parsed.path
    db_name = path.lstrip("/")
    test_db_name = f"{db_name}_test"
    admin_url = urlunparse(parsed._replace(path="/postgres"))
    test_db_url = urlunparse(parsed._replace(path=f"/{test_db_name}"))
    return admin_url, test_db_url


ADMIN_URL, TEST_DB_URL = _get_test_db_url()

# Ensure test database exists
admin_engine = create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
with admin_engine.connect() as conn:
    test_db_name = urlparse(TEST_DB_URL).path.lstrip("/")
    exists = conn.execute(
        text("SELECT 1 FROM pg_database WHERE datname = :name"),
        {"name": test_db_name},
    ).scalar()
    if not exists:
        conn.execute(text(f'CREATE DATABASE "{test_db_name}"'))
admin_engine.dispose()

test_engine = create_engine(TEST_DB_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create all tables on test DB once per session
Base.metadata.create_all(bind=test_engine)

# Ensure tests run with RAWG key empty by default so no real network is used
settings.rawg_api_key = ""


@pytest.fixture(autouse=True)
def clean_db() -> Generator[None, None, None]:
    with test_engine.connect() as conn:
        conn.execute(text("TRUNCATE TABLE users, games, genres, game_genres, library_entries, reviews, comments CASCADE;"))
        conn.commit()
    yield


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
