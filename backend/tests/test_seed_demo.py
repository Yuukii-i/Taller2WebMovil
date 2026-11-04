import pytest
from sqlalchemy.orm import Session

from app.models.game import Game
from app.models.user import User
from app.services.security import verify_password
from scripts.seed_demo import DEMO_DOMAIN, seed_demo_data


@pytest.fixture
def fixture_games(db_session: Session) -> list[Game]:
    games = []
    for i in range(1, 10):
        g = Game(
            rawg_id=1000 + i,
            title=f"Game {i}",
            slug=f"game-{i}",
            rawg_rating=4.5 - (i * 0.1),
        )
        db_session.add(g)
        games.append(g)
    db_session.commit()
    for g in games:
        db_session.refresh(g)
    return games


def test_seed_demo_data_creation_and_idempotence(
    db_session: Session, fixture_games: list[Game]
) -> None:
    res1 = seed_demo_data(
        db_session,
        password="valid_demo_password",
        min_games=5,
        reset=False,
    )

    assert res1["users"] == 15
    assert res1["entries"] > 0
    assert res1["reviews"] > 0
    assert res1["comments"] > 0

    # Second run without reset should be idempotent (print "already present" and change no counts)
    res2 = seed_demo_data(
        db_session,
        password="valid_demo_password",
        min_games=5,
        reset=False,
    )

    assert res2["users"] == res1["users"]
    assert res2["entries"] == res1["entries"]
    assert res2["reviews"] == res1["reviews"]
    assert res2["comments"] == res1["comments"]


def test_seed_demo_reset_leaves_non_demo_users_untouched(
    db_session: Session, fixture_games: list[Game]
) -> None:
    # Create non-demo user
    normal_user = User(
        username="normal_player",
        email="normal@personal.com",
        password_hash="some_hash",
    )
    db_session.add(normal_user)
    db_session.commit()
    db_session.refresh(normal_user)
    normal_user_id = normal_user.id

    # Seed demo users
    res1 = seed_demo_data(
        db_session,
        password="valid_demo_password",
        min_games=5,
        reset=False,
    )
    assert res1["users"] == 15

    # Run with reset=True
    res2 = seed_demo_data(
        db_session,
        password="valid_demo_password",
        min_games=5,
        reset=True,
    )
    assert res2["users"] == 15

    # Non-demo user MUST still exist and be untouched
    surviving_user = db_session.get(User, normal_user_id)
    assert surviving_user is not None
    assert surviving_user.username == "normal_player"
    assert surviving_user.email == "normal@personal.com"

    # All demo users should end with DEMO_DOMAIN
    demo_users = db_session.query(User).filter(User.email.ilike(f"%{DEMO_DOMAIN}")).all()
    assert len(demo_users) == 15


def test_seed_demo_min_games_threshold_check(db_session: Session) -> None:
    with pytest.raises(ValueError, match="at least 30 games"):
        seed_demo_data(
            db_session,
            password="valid_demo_password",
            min_games=30,
        )


def test_seed_demo_production_guard(
    monkeypatch: pytest.MonkeyPatch, db_session: Session, fixture_games: list[Game]
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(RuntimeError, match="Cannot run demo seed in production"):
        seed_demo_data(
            db_session,
            password="valid_demo_password",
            min_games=5,
        )


def test_seed_demo_password_verification(
    db_session: Session, fixture_games: list[Game]
) -> None:
    seed_demo_data(
        db_session,
        password="my_secret_demo_pwd",
        min_games=5,
    )

    demo_user = db_session.query(User).filter(User.email.ilike(f"%{DEMO_DOMAIN}")).first()
    assert demo_user is not None
    # Password hash must be argon2
    assert demo_user.password_hash.startswith("$argon2")
    # Verify password
    assert verify_password("my_secret_demo_pwd", demo_user.password_hash) is True
    assert verify_password("wrong_password", demo_user.password_hash) is False
