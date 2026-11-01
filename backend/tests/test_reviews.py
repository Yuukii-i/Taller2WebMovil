import time
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.comment import Comment
from app.models.game import Game
from app.models.review import Review
from tests.conftest import test_engine


def test_review_create_ok_and_validation(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    user, token, headers = auth_user_factory(username="author1", email="a1@test.com")
    game = Game(slug="rev-game", title="Rev Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    # Create OK
    resp = client.post(
        f"/api/games/{game.id}/reviews",
        json={"score": 8, "body": "   Great adventure!   "},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["game_id"] == game.id
    assert data["score"] == 8
    assert data["body"] == "Great adventure!"
    assert data["author"]["username"] == "author1"
    assert data["comment_count"] == 0

    # Duplicate review for same (user, game) -> 409
    resp_dup = client.post(
        f"/api/games/{game.id}/reviews",
        json={"score": 9, "body": "Second review"},
        headers=headers,
    )
    assert resp_dup.status_code == 409
    assert resp_dup.json()["detail"] == "you already reviewed this game"

    # Score out of bounds (0 or 11) -> 422
    user2, token2, headers2 = auth_user_factory(username="author2", email="a2@test.com")
    resp_score_0 = client.post(
        f"/api/games/{game.id}/reviews",
        json={"score": 0, "body": "zero"},
        headers=headers2,
    )
    assert resp_score_0.status_code == 422

    resp_score_11 = client.post(
        f"/api/games/{game.id}/reviews",
        json={"score": 11, "body": "eleven"},
        headers=headers2,
    )
    assert resp_score_11.status_code == 422

    # Body > 5000 -> 422
    resp_long_body = client.post(
        f"/api/games/{game.id}/reviews",
        json={"score": 5, "body": "a" * 5001},
        headers=headers2,
    )
    assert resp_long_body.status_code == 422

    # Empty body saved as null
    resp_empty_body = client.post(
        f"/api/games/{game.id}/reviews",
        json={"score": 7, "body": "   "},
        headers=headers2,
    )
    assert resp_empty_body.status_code == 201
    assert resp_empty_body.json()["body"] is None

    # Review unknown game -> 404
    user3, _, headers3 = auth_user_factory(username="author3", email="a3@test.com")
    resp_unknown_game = client.post(
        "/api/games/999999/reviews",
        json={"score": 5, "body": "None"},
        headers=headers3,
    )
    assert resp_unknown_game.status_code == 404


def test_review_edit_and_delete_permissions_and_cascade(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    owner, token_owner, headers_owner = auth_user_factory(username="owner", email="owner@test.com")
    stranger, token_stranger, headers_stranger = auth_user_factory(username="stranger", email="stranger@test.com")
    game = Game(slug="cascade-game", title="Cascade Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    # Create review
    resp_create = client.post(
        f"/api/games/{game.id}/reviews",
        json={"score": 6, "body": "Initial text"},
        headers=headers_owner,
    )
    review_id = resp_create.json()["id"]
    initial_updated_at = resp_create.json()["updated_at"]

    # Insert comment directly via DB
    comment = Comment(review_id=review_id, user_id=stranger.id, body="Nice review!")
    db_session.add(comment)
    db_session.commit()

    # Stranger tries PUT -> 403
    resp_put_forbidden = client.put(
        f"/api/reviews/{review_id}",
        json={"score": 9, "body": "Hacked"},
        headers=headers_stranger,
    )
    assert resp_put_forbidden.status_code == 403

    # Stranger tries DELETE -> 403
    resp_del_forbidden = client.delete(
        f"/api/reviews/{review_id}",
        headers=headers_stranger,
    )
    assert resp_del_forbidden.status_code == 403

    # Owner edits -> 200, updated_at refreshed
    time.sleep(0.01)
    resp_put_ok = client.put(
        f"/api/reviews/{review_id}",
        json={"score": 9, "body": "Updated text"},
        headers=headers_owner,
    )
    assert resp_put_ok.status_code == 200
    data_put = resp_put_ok.json()
    assert data_put["score"] == 9
    assert data_put["body"] == "Updated text"
    assert data_put["comment_count"] == 1
    assert data_put["updated_at"] >= initial_updated_at

    # Owner deletes -> 204, review and comments removed from DB
    resp_del_ok = client.delete(
        f"/api/reviews/{review_id}",
        headers=headers_owner,
    )
    assert resp_del_ok.status_code == 204
    assert db_session.get(Review, review_id) is None
    assert db_session.query(Comment).filter(Comment.review_id == review_id).count() == 0

    # Repeat delete -> 404
    resp_del_again = client.delete(
        f"/api/reviews/{review_id}",
        headers=headers_owner,
    )
    assert resp_del_again.status_code == 404


def test_review_sort_latest_vs_top_and_comment_count(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    u1, _, _ = auth_user_factory(username="u1", email="u1@test.com")
    u2, _, _ = auth_user_factory(username="u2", email="u2@test.com")
    u3, _, _ = auth_user_factory(username="u3", email="u3@test.com")

    game = Game(slug="sort-game", title="Sort Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    # R1: score 7, 2 comments, created first
    r1 = Review(user_id=u1.id, game_id=game.id, score=7, body="r1")
    # R2: score 10, 0 comments, created second
    r2 = Review(user_id=u2.id, game_id=game.id, score=10, body="r2")
    # R3: score 7, 5 comments, created third
    r3 = Review(user_id=u3.id, game_id=game.id, score=7, body="r3")
    db_session.add_all([r1, r2, r3])
    db_session.commit()

    c1 = Comment(review_id=r1.id, user_id=u1.id, body="c1")
    c2 = Comment(review_id=r1.id, user_id=u2.id, body="c2")
    c3 = Comment(review_id=r3.id, user_id=u1.id, body="c3")
    c4 = Comment(review_id=r3.id, user_id=u2.id, body="c4")
    c5 = Comment(review_id=r3.id, user_id=u3.id, body="c5")
    db_session.add_all([c1, c2, c3, c4, c5])
    db_session.commit()

    # Sort latest (created_at desc): r3, r2, r1
    resp_latest = client.get(f"/api/games/{game.id}/reviews?sort=latest")
    assert resp_latest.status_code == 200
    items_latest = resp_latest.json()["items"]
    assert [i["id"] for i in items_latest] == [r3.id, r2.id, r1.id]
    assert items_latest[0]["comment_count"] == 3
    assert items_latest[1]["comment_count"] == 0
    assert items_latest[2]["comment_count"] == 2

    # Sort top (score desc, comment_count desc):
    # r2 (score 10), then r3 (score 7, comments 3), then r1 (score 7, comments 2)
    resp_top = client.get(f"/api/games/{game.id}/reviews?sort=top")
    assert resp_top.status_code == 200
    items_top = resp_top.json()["items"]
    assert [i["id"] for i in items_top] == [r2.id, r3.id, r1.id]


def test_review_detail_and_game_detail_reflections(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    user, token, headers = auth_user_factory(username="reflector", email="ref@test.com")
    game = Game(slug="ref-game", title="Ref Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    # Initially game detail has avg_score None and my_review_id None
    resp_init = client.get(f"/api/games/{game.id}", headers=headers)
    assert resp_init.status_code == 200
    assert resp_init.json()["avg_score"] is None
    assert resp_init.json()["review_count"] == 0
    assert resp_init.json()["my_review_id"] is None

    # Post review
    resp_rev = client.post(
        f"/api/games/{game.id}/reviews",
        json={"score": 8, "body": "Great"},
        headers=headers,
    )
    rev_id = resp_rev.json()["id"]

    # Game detail reflects new review
    resp_after = client.get(f"/api/games/{game.id}", headers=headers)
    assert resp_after.status_code == 200
    assert resp_after.json()["avg_score"] == 8.0
    assert resp_after.json()["review_count"] == 1
    assert resp_after.json()["my_review_id"] == rev_id

    # GET /api/reviews/{id} returns ReviewWithGame
    resp_rev_get = client.get(f"/api/reviews/{rev_id}")
    assert resp_rev_get.status_code == 200
    data_rev = resp_rev_get.json()
    assert data_rev["id"] == rev_id
    assert data_rev["game"]["id"] == game.id
    assert data_rev["game"]["title"] == "Ref Game"

    # GET /api/reviews/999999 -> 404
    assert client.get("/api/reviews/999999").status_code == 404


def test_user_reviews_endpoint(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    user, token, headers = auth_user_factory(username="profile_user", email="prof@test.com")
    g1 = Game(slug="pg1", title="Prof Game 1", platforms=["PC"])
    g2 = Game(slug="pg2", title="Prof Game 2", platforms=["PC"])
    db_session.add_all([g1, g2])
    db_session.commit()

    client.post(f"/api/games/{g1.id}/reviews", json={"score": 9, "body": "b1"}, headers=headers)
    client.post(f"/api/games/{g2.id}/reviews", json={"score": 6, "body": "b2"}, headers=headers)

    # Public reviews page for user
    resp = client.get("/api/users/PROFILE_USER/reviews")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["game"]["id"] in [g1.id, g2.id]
    assert "author" in data["items"][0]

    # Unknown user -> 404
    assert client.get("/api/users/nobody/reviews").status_code == 404


def test_reviews_query_count_constant(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    game = Game(slug="query-game", title="Query Count Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    for i in range(25):
        u, _, _ = auth_user_factory(username=f"u_perf_{i}", email=f"perf_{i}@test.com")
        r = Review(user_id=u.id, game_id=game.id, score=8, body=f"Review {i}")
        db_session.add(r)
    db_session.commit()

    game_id = game.id
    # Expire cached attributes on db_session so fresh queries are isolated
    db_session.expunge_all()

    stmts = []
    bind = db_session.get_bind()

    def receive_execute(conn, cursor, statement, parameters, context, executemany):
        stmts.append(statement)

    event.listen(bind, "before_cursor_execute", receive_execute)
    try:
        stmts.clear()
        resp = client.get(f"/api/games/{game_id}/reviews?page=1&page_size=20")
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 20
        # Check statement count
        print(f"\nObserved statements for 20 reviews: {len(stmts)}")
        assert len(stmts) == 3  # 1: check game exists, 2: count total reviews, 3: fetch paginated reviews + author + comment counts
    finally:
        event.remove(bind, "before_cursor_execute", receive_execute)
