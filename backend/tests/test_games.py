from datetime import date
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

import app.services.rawg as rawg_service
from app.models.game import Game, Genre
from app.models.library import LibraryEntry, LibraryStatus
from app.models.review import Review
from app.models.user import User
from app.services.rawg import RawgError
from app.services.security import create_access_token


def test_genres_counts(client: TestClient, db_session: Session) -> None:
    # 0 genres in empty DB
    resp = client.get("/api/genres")
    assert resp.status_code == 200
    assert resp.json() == []

    # Insert genres and games
    g_action = Genre(name="Action", slug="action")
    g_rpg = Genre(name="RPG", slug="rpg")
    g_unused = Genre(name="Sports", slug="sports")
    db_session.add_all([g_action, g_rpg, g_unused])
    db_session.flush()

    game1 = Game(slug="game-1", title="Game 1", platforms=["PC"], genres=[g_action, g_rpg])
    game2 = Game(slug="game-2", title="Game 2", platforms=["PC"], genres=[g_action])
    db_session.add_all([game1, game2])
    db_session.commit()

    resp = client.get("/api/genres")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2  # Sports excluded because count is 0
    assert data[0]["slug"] == "action"
    assert data[0]["game_count"] == 2
    assert data[1]["slug"] == "rpg"
    assert data[1]["game_count"] == 1


def test_list_games_pagination_and_validation(client: TestClient, db_session: Session) -> None:
    for i in range(15):
        db_session.add(Game(slug=f"g-{i:02d}", title=f"Title {i:02d}", platforms=["PC"]))
    db_session.commit()

    resp = client.get("/api/games?page=1&page_size=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 15
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert len(data["items"]) == 10

    resp2 = client.get("/api/games?page=2&page_size=10")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["items"]) == 5

    # 422 on page_size > 50
    resp_inv = client.get("/api/games?page_size=51")
    assert resp_inv.status_code == 422

    # 422 on page < 1
    resp_inv2 = client.get("/api/games?page=0")
    assert resp_inv2.status_code == 422


def test_filter_by_genre(client: TestClient, db_session: Session) -> None:
    g1 = Genre(name="Action", slug="action")
    g2 = Genre(name="Puzzle", slug="puzzle")
    db_session.add_all([g1, g2])
    db_session.flush()

    game1 = Game(slug="act-1", title="Action Game", platforms=[], genres=[g1])
    game2 = Game(slug="puz-1", title="Puzzle Game", platforms=[], genres=[g2])
    db_session.add_all([game1, game2])
    db_session.commit()

    resp = client.get("/api/games?genre=action")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "act-1"


def test_filter_by_platform(client: TestClient, db_session: Session) -> None:
    game1 = Game(slug="pc-game", title="PC Game", platforms=["PC", "Xbox"])
    game2 = Game(slug="ps-game", title="PS Game", platforms=["PlayStation 5"])
    db_session.add_all([game1, game2])
    db_session.commit()

    resp = client.get("/api/games?platform=PlayStation 5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "ps-game"


def test_q_substring_and_wildcard_literal(client: TestClient, db_session: Session) -> None:
    game1 = Game(slug="pct-game", title="100% Orange Juice", platforms=[])
    game2 = Game(slug="norm-game", title="Orange", platforms=[])
    db_session.add_all([game1, game2])
    db_session.commit()

    # Search with literal "%" should match game1 and not everything
    resp = client.get("/api/games?q=%")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "pct-game"

    # Search substring "orange" case-insensitive
    resp2 = client.get("/api/games?q=ORANGE")
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 2


def test_sort_variants(client: TestClient, db_session: Session) -> None:
    u = User(username="reviewer", email="rev@test.com", password_hash="h")
    db_session.add(u)
    db_session.flush()

    g1 = Game(slug="g-a", title="Alpha", rawg_rating=4.5, release_date=date(2020, 1, 1), platforms=[])
    g2 = Game(slug="g-b", title="Beta", rawg_rating=4.8, release_date=date(2022, 1, 1), platforms=[])
    g3 = Game(slug="g-c", title="Gamma", rawg_rating=None, release_date=None, platforms=[])
    db_session.add_all([g1, g2, g3])
    db_session.flush()

    # Reviews for sort=reviews
    r1 = Review(user_id=u.id, game_id=g1.id, score=9)
    db_session.add(r1)
    db_session.commit()

    # Sort rating (default): Beta (4.8), Alpha (4.5), Gamma (None)
    resp_rating = client.get("/api/games?sort=rating")
    items_rating = resp_rating.json()["items"]
    assert [i["slug"] for i in items_rating] == ["g-b", "g-a", "g-c"]

    # Sort title: Alpha, Beta, Gamma
    resp_title = client.get("/api/games?sort=title")
    items_title = resp_title.json()["items"]
    assert [i["slug"] for i in items_title] == ["g-a", "g-b", "g-c"]

    # Sort release: Beta (2022), Alpha (2020), Gamma (None)
    resp_release = client.get("/api/games?sort=release")
    items_release = resp_release.json()["items"]
    assert [i["slug"] for i in items_release] == ["g-b", "g-a", "g-c"]

    # Sort reviews: Alpha (1 review), Beta (0), Gamma (0 - tie broken by id)
    resp_reviews = client.get("/api/games?sort=reviews")
    items_reviews = resp_reviews.json()["items"]
    assert items_reviews[0]["slug"] == "g-a"
    assert items_reviews[0]["review_count"] == 1


def test_rawg_fill_on_search(client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []

    def mock_search(q: str, page_size: int = 20) -> list[dict]:
        calls.append(q)
        return [
            {
                "id": 9991,
                "slug": "mario-odyssey",
                "name": "Super Mario Odyssey",
                "released": "2017-10-27",
                "background_image": "http://img.com/mario.jpg",
                "rating": 4.7,
                "genres": [{"id": 1, "name": "Platformer", "slug": "platformer"}],
                "platforms": [{"platform": {"name": "Nintendo Switch"}}],
            }
        ]

    monkeypatch.setattr("app.routers.games.search_games", mock_search)

    # Initial search with <5 local results triggers RAWG
    resp = client.get("/api/games?q=Mario")
    assert resp.status_code == 200
    data = resp.json()
    assert len(calls) == 1
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "mario-odyssey"
    assert data["items"][0]["platforms"] == ["Nintendo Switch"]

    # Second identical search should not duplicate rows
    resp2 = client.get("/api/games?q=Mario")
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 1

    # Insert 5 games matching 'Mario' -> RAWG must NOT be called
    for i in range(5):
        db_session.add(Game(slug=f"mario-{i}", title=f"Mario Kart {i}", platforms=[]))
    db_session.commit()

    calls.clear()
    resp3 = client.get("/api/games?q=Mario")
    assert resp3.status_code == 200
    assert len(calls) == 0  # RAWG not called because local count >= 5


def test_rawg_error_swallowed_on_search(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def mock_search_fail(q: str, page_size: int = 20) -> list[dict]:
        raise RawgError("Network timeout")

    monkeypatch.setattr("app.routers.games.search_games", mock_search_fail)

    resp = client.get("/api/games?q=Zelda")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_game_detail_stats_and_lazy_description(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    rawg_get_calls = []

    def mock_get_game(rawg_id: int) -> dict:
        rawg_get_calls.append(rawg_id)
        return {
            "id": rawg_id,
            "description_raw": "A great adventure game.",
        }

    monkeypatch.setattr("app.services.game_import.get_game", mock_get_game)

    # Setup game without description
    game = Game(rawg_id=12345, slug="witcher-3", title="The Witcher 3", platforms=["PC"])
    u1 = User(username="user1", email="u1@test.com", password_hash="h1")
    u2 = User(username="user2", email="u2@test.com", password_hash="h2")
    db_session.add_all([game, u1, u2])
    db_session.flush()

    # Add reviews: score 9 and 8 -> avg 8.5
    r1 = Review(user_id=u1.id, game_id=game.id, score=9)
    r2 = Review(user_id=u2.id, game_id=game.id, score=8)
    # Add library entry
    lib = LibraryEntry(user_id=u1.id, game_id=game.id, status=LibraryStatus.playing)
    db_session.add_all([r1, r2, lib])
    db_session.commit()

    # Anonymous request
    resp_anon = client.get(f"/api/games/{game.id}")
    assert resp_anon.status_code == 200
    data_anon = resp_anon.json()
    assert data_anon["avg_score"] == 8.5
    assert data_anon["review_count"] == 2
    assert data_anon["status_counts"]["playing"] == 1
    assert data_anon["status_counts"]["wishlist"] == 0
    assert data_anon["my_status"] is None
    assert data_anon["my_review_id"] is None
    assert data_anon["description"] == "A great adventure game."
    assert len(rawg_get_calls) == 1

    # Second view: description already set -> RAWG not called again
    resp_anon2 = client.get(f"/api/games/{game.id}")
    assert resp_anon2.status_code == 200
    assert len(rawg_get_calls) == 1

    # Authenticated request (u1)
    token = create_access_token(u1.id)
    resp_auth = client.get(f"/api/games/{game.id}", headers={"Authorization": f"Bearer {token}"})
    assert resp_auth.status_code == 200
    data_auth = resp_auth.json()
    assert data_auth["my_status"] == "playing"
    assert data_auth["my_review_id"] == r1.id

    # 404 for missing game
    resp_404 = client.get("/api/games/999999")
    assert resp_404.status_code == 404
