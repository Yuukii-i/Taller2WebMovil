import time
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.game import Game
from app.models.library import LibraryEntry, LibraryStatus


def test_library_upsert_and_updated_at(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    user, token, headers = auth_user_factory(username="libuser", email="lib@test.com")
    game = Game(slug="game-one", title="Game One", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    # First PUT creates entry
    resp1 = client.put(f"/api/library/{game.id}", json={"status": "wishlist"}, headers=headers)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["game_id"] == game.id
    assert data1["status"] == "wishlist"
    first_updated_at = data1["updated_at"]

    # Verify 1 row in DB
    entries = db_session.query(LibraryEntry).filter(LibraryEntry.user_id == user.id).all()
    assert len(entries) == 1
    assert entries[0].status == LibraryStatus.wishlist

    # Second PUT updates status and refreshes updated_at (even with later status)
    time.sleep(0.01)
    resp2 = client.put(f"/api/library/{game.id}", json={"status": "playing"}, headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "playing"
    second_updated_at = data2["updated_at"]

    entries_after = db_session.query(LibraryEntry).filter(LibraryEntry.user_id == user.id).all()
    assert len(entries_after) == 1
    assert entries_after[0].status == LibraryStatus.playing

    # Third PUT with same status still updates updated_at
    time.sleep(0.01)
    resp3 = client.put(f"/api/library/{game.id}", json={"status": "playing"}, headers=headers)
    assert resp3.status_code == 200
    third_updated_at = resp3.json()["updated_at"]
    assert third_updated_at >= second_updated_at


def test_library_delete_idempotent(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    user, token, headers = auth_user_factory(username="deluser", email="del@test.com")
    game = Game(slug="del-game", title="Delete Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    # Add entry
    client.put(f"/api/library/{game.id}", json={"status": "completed"}, headers=headers)
    assert db_session.query(LibraryEntry).count() == 1

    # First DELETE -> 204
    resp_del1 = client.delete(f"/api/library/{game.id}", headers=headers)
    assert resp_del1.status_code == 204
    assert db_session.query(LibraryEntry).count() == 0

    # Second DELETE on non-existent entry -> 204
    resp_del2 = client.delete(f"/api/library/{game.id}", headers=headers)
    assert resp_del2.status_code == 204

    # DELETE on non-existent game -> 204
    resp_del_unreal = client.delete("/api/library/99999", headers=headers)
    assert resp_del_unreal.status_code == 204


def test_library_validation_and_auth(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    user, token, headers = auth_user_factory(username="valuser", email="val@test.com")
    game = Game(slug="val-game", title="Val Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    # Anonymous PUT -> 401
    resp_anon = client.put(f"/api/library/{game.id}", json={"status": "wishlist"})
    assert resp_anon.status_code == 401

    # Invalid status -> 422
    resp_invalid_status = client.put(
        f"/api/library/{game.id}", json={"status": "not_a_valid_status"}, headers=headers
    )
    assert resp_invalid_status.status_code == 422

    # Unknown game -> 404
    resp_404 = client.put("/api/library/999999", json={"status": "wishlist"}, headers=headers)
    assert resp_404.status_code == 404


def test_public_user_library_and_filtering(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    user, token, headers = auth_user_factory(username="target_user", email="target@test.com")
    g1 = Game(slug="game-a", title="Game A", platforms=["PC"])
    g2 = Game(slug="game-b", title="Game B", platforms=["Xbox"])
    g3 = Game(slug="game-c", title="Game C", platforms=["Switch"])
    db_session.add_all([g1, g2, g3])
    db_session.commit()

    # Add entries
    client.put(f"/api/library/{g1.id}", json={"status": "playing"}, headers=headers)
    client.put(f"/api/library/{g2.id}", json={"status": "completed"}, headers=headers)
    client.put(f"/api/library/{g3.id}", json={"status": "playing"}, headers=headers)

    # Public anonymous read (case-insensitive username)
    resp = client.get("/api/users/TARGET_USER/library")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3
    # Check shape
    item0 = data["items"][0]
    assert "game" in item0
    assert "status" in item0
    assert "updated_at" in item0
    assert item0["game"]["title"] in ["Game A", "Game B", "Game C"]

    # Filter by status: playing -> 2 items
    resp_playing = client.get("/api/users/target_user/library?status=playing")
    assert resp_playing.status_code == 200
    data_playing = resp_playing.json()
    assert data_playing["total"] == 2
    for item in data_playing["items"]:
        assert item["status"] == "playing"

    # Filter by invalid status -> 422
    resp_invalid = client.get("/api/users/target_user/library?status=unknown")
    assert resp_invalid.status_code == 422

    # Unknown username -> 404
    resp_unknown = client.get("/api/users/does_not_exist/library")
    assert resp_unknown.status_code == 404
