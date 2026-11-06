from datetime import date
import json
import pytest
from fastapi.testclient import TestClient
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.game import Game, Genre
from app.models.library import LibraryEntry, LibraryStatus
from app.models.review import Review
from app.models.user import User
import app.services.igdb as igdb_service
from app.services.igdb import (
    IgdbError,
    escape_query_string,
    list_popular,
    search_games,
)
from app.services.game_import import upsert_games
from app.services.security import create_access_token


def test_genres_counts(client: TestClient, db_session: Session) -> None:
    resp = client.get("/api/genres")
    assert resp.status_code == 200
    assert resp.json() == []

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
    assert len(data) == 2
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

    resp_inv = client.get("/api/games?page_size=51")
    assert resp_inv.status_code == 422

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

    resp = client.get("/api/games?q=%")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "pct-game"

    resp2 = client.get("/api/games?q=ORANGE")
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 2


def test_sort_variants(client: TestClient, db_session: Session) -> None:
    u = User(username="reviewer", email="rev@test.com", password_hash="h")
    db_session.add(u)
    db_session.flush()

    g1 = Game(slug="g-a", title="Alpha", igdb_rating=85.0, release_date=date(2020, 1, 1), platforms=[])
    g2 = Game(slug="g-b", title="Beta", igdb_rating=92.0, release_date=date(2022, 1, 1), platforms=[])
    g3 = Game(slug="g-c", title="Gamma", igdb_rating=None, release_date=None, platforms=[])
    db_session.add_all([g1, g2, g3])
    db_session.flush()

    r1 = Review(user_id=u.id, game_id=g1.id, score=9)
    db_session.add(r1)
    db_session.commit()

    # Sort rating (default): Beta (92.0), Alpha (85.0), Gamma (None)
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


def test_game_detail_stats(client: TestClient, db_session: Session) -> None:
    game = Game(
        igdb_id=12345,
        slug="witcher-3",
        title="The Witcher 3",
        platforms=["PC"],
        description="A great adventure game.",
        cover_url="http://img.com/cover.jpg",
        background_url="http://img.com/bg.jpg",
        igdb_rating=93.5,
    )
    u1 = User(username="user1", email="u1@test.com", password_hash="h1")
    u2 = User(username="user2", email="u2@test.com", password_hash="h2")
    db_session.add_all([game, u1, u2])
    db_session.flush()

    r1 = Review(user_id=u1.id, game_id=game.id, score=9)
    r2 = Review(user_id=u2.id, game_id=game.id, score=8)
    lib = LibraryEntry(user_id=u1.id, game_id=game.id, status=LibraryStatus.playing)
    db_session.add_all([r1, r2, lib])
    db_session.commit()

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
    assert data_anon["igdb_rating"] == 93.5
    assert data_anon["background_url"] == "http://img.com/bg.jpg"

    token = create_access_token(u1.id)
    resp_auth = client.get(f"/api/games/{game.id}", headers={"Authorization": f"Bearer {token}"})
    assert resp_auth.status_code == 200
    data_auth = resp_auth.json()
    assert data_auth["my_status"] == "playing"
    assert data_auth["my_review_id"] == r1.id

    resp_404 = client.get("/api/games/999999")
    assert resp_404.status_code == 404


def test_igdb_token_caching(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "igdb_client_id", "test_id")
    monkeypatch.setattr(settings, "igdb_client_secret", "test_secret")
    igdb_service.token_manager.invalidate()

    auth_calls = 0
    games_calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal auth_calls, games_calls
        if "id.twitch.tv" in str(request.url):
            auth_calls += 1
            return httpx.Response(
                200,
                json={"access_token": "mocked_tok", "expires_in": 3600, "token_type": "bearer"},
            )
        if "api.igdb.com" in str(request.url):
            games_calls += 1
            assert request.headers["Authorization"] == "Bearer mocked_tok"
            assert request.headers["Client-ID"] == "test_id"
            return httpx.Response(200, json=[{"id": 1, "name": "Game 1"}])
        return httpx.Response(404)

    mock_transport = httpx.MockTransport(handler)
    monkeypatch.setattr(igdb_service, "_custom_transport", mock_transport)

    # First call: hits auth + games
    res1 = list_popular(page=1, page_size=10)
    assert len(res1) == 1
    assert auth_calls == 1
    assert games_calls == 1

    # Second call: re-uses cached token, hits ONLY games
    res2 = list_popular(page=2, page_size=10)
    assert len(res2) == 1
    assert auth_calls == 1
    assert games_calls == 2


def test_igdb_token_401_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "igdb_client_id", "test_id")
    monkeypatch.setattr(settings, "igdb_client_secret", "test_secret")
    igdb_service.token_manager.invalidate()

    token_counter = 0
    game_call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_counter, game_call_count
        if "id.twitch.tv" in str(request.url):
            token_counter += 1
            return httpx.Response(
                200,
                json={"access_token": f"token_{token_counter}", "expires_in": 3600},
            )
        if "api.igdb.com" in str(request.url):
            game_call_count += 1
            if request.headers.get("Authorization") == "Bearer token_1":
                # Stale token returns 401
                return httpx.Response(401, json={"message": "Token expired"})
            if request.headers.get("Authorization") == "Bearer token_2":
                return httpx.Response(200, json=[{"id": 42, "name": "Success Game"}])
        return httpx.Response(404)

    mock_transport = httpx.MockTransport(handler)
    monkeypatch.setattr(igdb_service, "_custom_transport", mock_transport)

    results = list_popular(page=1, page_size=10)
    assert len(results) == 1
    assert results[0]["name"] == "Success Game"
    assert token_counter == 2
    assert game_call_count == 2


def test_igdb_string_escaping(monkeypatch: pytest.MonkeyPatch) -> None:
    raw_query = 'Zelda "Breath \\ of" Wild'
    escaped = escape_query_string(raw_query)
    assert '\\"' in escaped
    assert '\\\\' in escaped

    sent_body = ""

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal sent_body
        if "id.twitch.tv" in str(request.url):
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 3600})
        if "api.igdb.com" in str(request.url):
            sent_body = request.content.decode("utf-8")
            return httpx.Response(200, json=[])
        return httpx.Response(404)

    monkeypatch.setattr(settings, "igdb_client_id", "test_id")
    monkeypatch.setattr(settings, "igdb_client_secret", "test_secret")
    igdb_service.token_manager.invalidate()
    monkeypatch.setattr(igdb_service, "_custom_transport", httpx.MockTransport(handler))

    search_games(raw_query)
    assert 'search "Zelda \\"Breath \\\\ of\\" Wild";' in sent_body


def test_igdb_import_mapping(db_session: Session) -> None:
    sample_payload = [
        {
            "id": 1234,
            "name": "Chrono Trigger",
            "slug": "chrono-trigger",
            "summary": "A classic time-travel RPG.",
            "first_release_date": 794966400,  # 1995-03-11
            "total_rating": 93.8,
            "cover": {"id": 10, "image_id": "co1abc"},
            "screenshots": [{"id": 20, "image_id": "sc2def"}],
            "artworks": [{"id": 30, "image_id": "ar3ghi"}],
            "genres": [{"id": 1, "name": "Role-playing (RPG)", "slug": "rpg"}],
            "platforms": [{"id": 5, "name": "Super Nintendo Entertainment System (SNES)"}],
        }
    ]

    games = upsert_games(db_session, sample_payload)
    assert len(games) == 1
    g = games[0]
    assert g.igdb_id == 1234
    assert g.slug == "chrono-trigger"
    assert g.title == "Chrono Trigger"
    assert g.cover_url == "https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg"
    assert g.background_url == "https://images.igdb.com/igdb/image/upload/t_1080p/sc2def.jpg"
    assert g.description == "A classic time-travel RPG."
    assert g.release_date == date(1995, 3, 12)
    assert g.igdb_rating == 93.8
    assert g.platforms == ["Super Nintendo Entertainment System (SNES)"]
    assert len(g.genres) == 1
    assert g.genres[0].slug == "rpg"


def test_igdb_search_fill(client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []

    def mock_search(q: str, page_size: int = 20) -> list[dict]:
        calls.append(q)
        return [
            {
                "id": 9991,
                "slug": "mario-odyssey",
                "name": "Super Mario Odyssey",
                "summary": "Join Mario on a massive globetrotting 3D adventure.",
                "first_release_date": 1509062400,
                "cover": {"image_id": "co_mario"},
                "screenshots": [{"image_id": "sc_mario"}],
                "total_rating": 97.2,
                "genres": [{"name": "Platform", "slug": "platform"}],
                "platforms": [{"name": "Nintendo Switch"}],
            }
        ]

    monkeypatch.setattr("app.routers.games.search_games", mock_search)

    # Search with <5 local results triggers IGDB search
    resp = client.get("/api/games?q=Mario")
    assert resp.status_code == 200
    data = resp.json()
    assert len(calls) == 1
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "mario-odyssey"
    assert data["items"][0]["platforms"] == ["Nintendo Switch"]
    assert data["items"][0]["background_url"] == "https://images.igdb.com/igdb/image/upload/t_1080p/sc_mario.jpg"

    # Second identical search should not duplicate rows
    resp2 = client.get("/api/games?q=Mario")
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 1

    # Insert 5 games matching 'Mario' -> IGDB must NOT be called
    for i in range(5):
        db_session.add(Game(slug=f"mario-{i}", title=f"Mario Kart {i}", platforms=[]))
    db_session.commit()

    calls.clear()
    resp3 = client.get("/api/games?q=Mario")
    assert resp3.status_code == 200
    assert len(calls) == 0


def test_igdb_error_swallowed_on_search(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def mock_search_fail(q: str, page_size: int = 20) -> list[dict]:
        raise IgdbError("Network timeout")

    monkeypatch.setattr("app.routers.games.search_games", mock_search_fail)

    resp = client.get("/api/games?q=Zelda")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []
