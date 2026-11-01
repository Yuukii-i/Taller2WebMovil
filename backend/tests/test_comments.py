from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.comment import Comment
from app.models.game import Game
from app.models.review import Review


def test_comments_create_and_validation(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    u1, _, h1 = auth_user_factory(username="c_user1", email="c1@test.com")
    game = Game(slug="c-game", title="C Game", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    review = Review(user_id=u1.id, game_id=game.id, score=9, body="Awesome game")
    db_session.add(review)
    db_session.commit()

    # Create comment 201 (author commenting on own review is allowed)
    resp = client.post(
        f"/api/reviews/{review.id}/comments",
        json={"body": "   First comment!   "},
        headers=h1,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["review_id"] == review.id
    assert data["body"] == "First comment!"
    assert data["author"]["username"] == "c_user1"

    # Anonymous create -> 401
    resp_anon = client.post(f"/api/reviews/{review.id}/comments", json={"body": "Anon comment"})
    assert resp_anon.status_code == 401

    # Blank / whitespace only -> 422
    resp_blank = client.post(
        f"/api/reviews/{review.id}/comments",
        json={"body": "    "},
        headers=h1,
    )
    assert resp_blank.status_code == 422

    # Empty string -> 422
    resp_empty = client.post(
        f"/api/reviews/{review.id}/comments",
        json={"body": ""},
        headers=h1,
    )
    assert resp_empty.status_code == 422

    # 1001 chars -> 422
    resp_long = client.post(
        f"/api/reviews/{review.id}/comments",
        json={"body": "x" * 1001},
        headers=h1,
    )
    assert resp_long.status_code == 422

    # Unknown review -> 404
    resp_404 = client.post(
        "/api/reviews/999999/comments",
        json={"body": "Lost comment"},
        headers=h1,
    )
    assert resp_404.status_code == 404


def test_comments_list_order_oldest_first(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    u1, _, h1 = auth_user_factory(username="u_list", email="ulist@test.com")
    game = Game(slug="c-game-list", title="C Game List", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    review = Review(user_id=u1.id, game_id=game.id, score=8, body="Review")
    db_session.add(review)
    db_session.commit()

    c1 = Comment(review_id=review.id, user_id=u1.id, body="oldest")
    c2 = Comment(review_id=review.id, user_id=u1.id, body="middle")
    c3 = Comment(review_id=review.id, user_id=u1.id, body="newest")
    db_session.add_all([c1, c2, c3])
    db_session.commit()

    resp = client.get(f"/api/reviews/{review.id}/comments")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    items = data["items"]
    assert [i["body"] for i in items] == ["oldest", "middle", "newest"]

    # Unknown review comments list -> 404
    assert client.get("/api/reviews/999999/comments").status_code == 404


def test_comments_deletion_permissions_and_cascade(
    client: TestClient, db_session: Session, auth_user_factory
) -> None:
    rev_author, _, h_rev = auth_user_factory(username="rev_author", email="ra@test.com")
    comm_author, _, h_comm = auth_user_factory(username="comm_author", email="ca@test.com")
    stranger, _, h_stranger = auth_user_factory(username="stranger", email="str@test.com")

    game = Game(slug="c-game-del", title="C Game Del", platforms=["PC"])
    db_session.add(game)
    db_session.commit()

    review = Review(user_id=rev_author.id, game_id=game.id, score=7, body="Review")
    db_session.add(review)
    db_session.commit()

    # Stranger tries 403 on comment deletion
    c1 = Comment(review_id=review.id, user_id=comm_author.id, body="Comment 1")
    c2 = Comment(review_id=review.id, user_id=comm_author.id, body="Comment 2")
    c3 = Comment(review_id=review.id, user_id=comm_author.id, body="Comment 3")
    db_session.add_all([c1, c2, c3])
    db_session.commit()

    # Third user (neither comment author nor review author) -> 403
    resp_403 = client.delete(f"/api/comments/{c1.id}", headers=h_stranger)
    assert resp_403.status_code == 403

    # Comment author deletes comment -> 204
    resp_comm_del = client.delete(f"/api/comments/{c1.id}", headers=h_comm)
    assert resp_comm_del.status_code == 204
    assert db_session.get(Comment, c1.id) is None

    # Review author deletes comment created by someone else -> 204
    resp_rev_del = client.delete(f"/api/comments/{c2.id}", headers=h_rev)
    assert resp_rev_del.status_code == 204
    assert db_session.get(Comment, c2.id) is None

    # Unknown comment deletion -> 404
    resp_404 = client.delete("/api/comments/999999", headers=h_comm)
    assert resp_404.status_code == 404

    # Deleting a review removes its comments
    c3_id = c3.id
    assert db_session.get(Comment, c3_id) is not None
    client.delete(f"/api/reviews/{review.id}", headers=h_rev)
    assert db_session.get(Comment, c3_id) is None
