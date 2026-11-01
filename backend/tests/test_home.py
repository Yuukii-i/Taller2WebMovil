from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.game import Game
from app.models.library import LibraryEntry, LibraryStatus
from app.models.review import Review


def test_home_empty_db(client: TestClient) -> None:
    resp = client.get("/api/home")
    assert resp.status_code == 200
    data = resp.json()
    assert data["most_wishlisted"] == []
    assert data["most_abandoned"] == []
    assert data["most_playing"] == []
    assert data["most_completed"] == []
    assert data["top_rated"] == []
    assert data["recent_reviews"] == []


def test_home_library_lists_ordering_and_cap(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    # Create 15 games
    games = [Game(slug=f"hg-{i:02d}", title=f"HGame {i:02d}", platforms=["PC"]) for i in range(15)]
    db_session.add_all(games)
    db_session.commit()

    # Create users
    users = [auth_user_factory(username=f"hu_{i}", email=f"hu_{i}@test.com")[0] for i in range(12)]

    # Game 0: 5 wishlist entries
    for u in users[:5]:
        db_session.add(LibraryEntry(user_id=u.id, game_id=games[0].id, status=LibraryStatus.wishlist))

    # Game 1: 3 wishlist entries
    for u in users[:3]:
        db_session.add(LibraryEntry(user_id=u.id, game_id=games[1].id, status=LibraryStatus.wishlist))

    # Game 2: 1 wishlist entry
    db_session.add(LibraryEntry(user_id=users[0].id, game_id=games[2].id, status=LibraryStatus.wishlist))

    # Game 3: 0 entries (must be excluded from wishlist)
    db_session.commit()

    resp = client.get("/api/home")
    assert resp.status_code == 200
    data = resp.json()
    wishlisted = data["most_wishlisted"]
    assert len(wishlisted) == 3  # excludes zeros
    assert wishlisted[0]["game"]["id"] == games[0].id
    assert wishlisted[0]["count"] == 5
    assert wishlisted[1]["game"]["id"] == games[1].id
    assert wishlisted[1]["count"] == 3
    assert wishlisted[2]["game"]["id"] == games[2].id
    assert wishlisted[2]["count"] == 1

    # Verify capped at 10 items
    # Add 1 playing entry for games 0 through 11 using users[11] (who has no existing entries)
    for g in games[:12]:
        db_session.add(LibraryEntry(user_id=users[11].id, game_id=g.id, status=LibraryStatus.playing))
    db_session.commit()

    resp2 = client.get("/api/home")
    data2 = resp2.json()
    assert len(data2["most_playing"]) == 10  # Capped at max 10


def test_home_top_rated_threshold_and_recent_reviews(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    u1, _, _ = auth_user_factory(username="tu1", email="tu1@test.com")
    u2, _, _ = auth_user_factory(username="tu2", email="tu2@test.com")
    u3, _, _ = auth_user_factory(username="tu3", email="tu3@test.com")

    g_qualifies = Game(slug="g-qual", title="Qualifies Game", platforms=["PC"])
    g_not_enough = Game(slug="g-few", title="Few Reviews Game", platforms=["PC"])
    db_session.add_all([g_qualifies, g_not_enough])
    db_session.commit()

    # g_not_enough has only 2 reviews (average 10.0) -> must be excluded (< 3 reviews)
    db_session.add(Review(user_id=u1.id, game_id=g_not_enough.id, score=10))
    db_session.add(Review(user_id=u2.id, game_id=g_not_enough.id, score=10))

    # g_qualifies has 3 reviews (average 8.0) -> included
    r1 = Review(user_id=u1.id, game_id=g_qualifies.id, score=8, body="r1")
    r2 = Review(user_id=u2.id, game_id=g_qualifies.id, score=8, body="r2")
    r3 = Review(user_id=u3.id, game_id=g_qualifies.id, score=8, body="r3")
    db_session.add_all([r1, r2, r3])
    db_session.commit()

    resp = client.get("/api/home")
    assert resp.status_code == 200
    data = resp.json()

    top_rated = data["top_rated"]
    assert len(top_rated) == 1
    assert top_rated[0]["game"]["id"] == g_qualifies.id
    assert top_rated[0]["avg_score"] == 8.0
    assert top_rated[0]["review_count"] == 3

    recent = data["recent_reviews"]
    assert len(recent) == 5
    # Should contain ReviewWithGame with game card
    assert "game" in recent[0]
    assert "author" in recent[0]


def test_home_library_change_reflected_immediately(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    u1, _, h1 = auth_user_factory(username="refl_user", email="refl@test.com")
    game = Game(slug="refl-game", title="Refl Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    # Initially empty completed
    assert client.get("/api/home").json()["most_completed"] == []

    # User marks as completed
    client.put(f"/api/library/{game.id}", json={"status": "completed"}, headers=h1)

    # Next call immediately reflects the change
    resp = client.get("/api/home")
    completed = resp.json()["most_completed"]
    assert len(completed) == 1
    assert completed[0]["game"]["id"] == game.id
    assert completed[0]["count"] == 1


def test_home_statement_count_constant(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    # Populate games and entries
    u, _, _ = auth_user_factory(username="stmt_u", email="stmt_u@test.com")
    for i in range(5):
        g = Game(slug=f"sg-{i}", title=f"Stmt Game {i}", platforms=["PC"])
        db_session.add(g)
        db_session.flush()
        db_session.add(LibraryEntry(user_id=u.id, game_id=g.id, status=LibraryStatus.wishlist))
        db_session.add(Review(user_id=u.id, game_id=g.id, score=9))
    db_session.commit()

    db_session.expunge_all()

    stmts = []
    bind = db_session.get_bind()

    def receive_execute(conn, cursor, statement, parameters, context, executemany):
        stmts.append(statement)

    event.listen(bind, "before_cursor_execute", receive_execute)
    try:
        stmts.clear()
        resp = client.get("/api/home")
        assert resp.status_code == 200
        print(f"\nObserved statements for GET /api/home: {len(stmts)}")
        # 4 status queries + 1 top_rated + 1 recent_reviews + 1 build_game_cards query + 1 selectinload genres = 8 queries
        assert len(stmts) <= 10
    finally:
        event.remove(bind, "before_cursor_execute", receive_execute)
