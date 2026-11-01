from datetime import datetime, timezone, timedelta
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User


def test_register_ok(client: TestClient, db_session: Session) -> None:
    resp = client.post(
        "/api/auth/register",
        json={"username": "valid_user", "email": "User@Example.COM", "password": "password123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "valid_user"
    assert data["email"] == "user@example.com"
    assert "id" in data
    assert "password" not in resp.text.lower() or "password123" not in resp.text

    # Verify DB row has argon2 hash
    user = db_session.scalar(select(User).where(User.username == "valid_user"))
    assert user is not None
    assert user.password_hash.startswith("$argon2")
    assert "password" not in user.password_hash


def test_register_duplicate_username_409(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@test.com", "password": "password123"},
    )
    resp = client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice2@test.com", "password": "password123"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "username already taken"


def test_register_duplicate_email_case_insensitive_409(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@test.com", "password": "password123"},
    )
    resp = client.post(
        "/api/auth/register",
        json={"username": "bob", "email": "ALICE@TEST.COM", "password": "password123"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "email already registered"


def test_register_validation_errors_422(client: TestClient) -> None:
    # Invalid username (pattern / length)
    resp1 = client.post(
        "/api/auth/register",
        json={"username": "ab", "email": "valid@test.com", "password": "password123"},
    )
    assert resp1.status_code == 422

    # Short password (< 8 chars)
    resp2 = client.post(
        "/api/auth/register",
        json={"username": "valid_user", "email": "valid@test.com", "password": "short"},
    )
    assert resp2.status_code == 422

    # Bad email
    resp3 = client.post(
        "/api/auth/register",
        json={"username": "valid_user", "email": "not-an-email", "password": "password123"},
    )
    assert resp3.status_code == 422


def test_login_by_email_ok(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"username": "bob123", "email": "bob@example.com", "password": "password123"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"identifier": "BOB@EXAMPLE.COM", "password": "password123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "bob123"
    assert "password" not in resp.text.lower() or "password123" not in resp.text


def test_login_by_username_ok(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"username": "bob123", "email": "bob@example.com", "password": "password123"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"identifier": "BOB123", "password": "password123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "bob@example.com"


def test_login_wrong_password_and_unknown_user_identical_401(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"username": "charlie", "email": "charlie@test.com", "password": "password123"},
    )
    # Wrong password for existing user
    resp_wrong_pw = client.post(
        "/api/auth/login",
        json={"identifier": "charlie", "password": "wrongpassword"},
    )
    # Unknown user
    resp_unknown = client.post(
        "/api/auth/login",
        json={"identifier": "unknown_user", "password": "wrongpassword"},
    )
    assert resp_wrong_pw.status_code == 401
    assert resp_unknown.status_code == 401
    assert resp_wrong_pw.json() == resp_unknown.json()
    assert resp_wrong_pw.json()["detail"] == "Invalid credentials"


def test_users_me_auth_variations(client: TestClient) -> None:
    # 401 without token
    resp_no_token = client.get("/api/users/me")
    assert resp_no_token.status_code == 401
    assert "WWW-Authenticate" in resp_no_token.headers

    # 401 with garbage token
    resp_garbage = client.get("/api/users/me", headers={"Authorization": "Bearer garbage.token.here"})
    assert resp_garbage.status_code == 401
    assert "WWW-Authenticate" in resp_garbage.headers

    # Register user
    reg_resp = client.post(
        "/api/auth/register",
        json={"username": "david", "email": "david@test.com", "password": "password123"},
    )
    user_id = reg_resp.json()["id"]

    # 401 with expired token
    now = datetime.now(timezone.utc)
    expired_payload = {
        "sub": str(user_id),
        "iat": int((now - timedelta(hours=2)).timestamp()),
        "exp": int((now - timedelta(hours=1)).timestamp()),
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret, algorithm="HS256")
    resp_expired = client.get("/api/users/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp_expired.status_code == 401
    assert "WWW-Authenticate" in resp_expired.headers

    # 200 with valid token
    login_resp = client.post(
        "/api/auth/login",
        json={"identifier": "david", "password": "password123"},
    )
    token = login_resp.json()["access_token"]
    resp_valid = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp_valid.status_code == 200
    assert resp_valid.json()["username"] == "david"
    assert "password" not in resp_valid.text.lower()


def test_logout_behavior(client: TestClient) -> None:
    # Logout 401 without token
    resp_unauth = client.post("/api/auth/logout")
    assert resp_unauth.status_code == 401

    # Register and login
    client.post(
        "/api/auth/register",
        json={"username": "eva", "email": "eva@test.com", "password": "password123"},
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"identifier": "eva", "password": "password123"},
    )
    token = login_resp.json()["access_token"]

    # Logout 204 with token
    resp_logout = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp_logout.status_code == 204


def test_user_public_profile(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"username": "frank", "email": "frank@test.com", "password": "password123"},
    )
    resp = client.get("/api/users/frank")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "frank"
    assert data["review_count"] == 0
    assert data["library_counts"] == {
        "wishlist": 0,
        "playing": 0,
        "completed": 0,
        "abandoned": 0,
    }
    assert "email" not in data
    assert "password" not in resp.text.lower()

    # 404 for unknown user
    resp_404 = client.get("/api/users/unknown_frank")
    assert resp_404.status_code == 404


def test_no_response_bodies_contain_password(client: TestClient) -> None:
    reg_resp = client.post(
        "/api/auth/register",
        json={"username": "grace", "email": "grace@test.com", "password": "password123"},
    )
    # Check json keys of successful responses
    assert "password" not in reg_resp.json()
    assert "password_hash" not in reg_resp.json()

    login_resp = client.post(
        "/api/auth/login",
        json={"identifier": "grace", "password": "password123"},
    )
    assert "password" not in login_resp.json()
    assert "password_hash" not in login_resp.json()
    token = login_resp.json()["access_token"]

    me_resp = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert "password" not in me_resp.json()
    assert "password_hash" not in me_resp.json()

    user_resp = client.get("/api/users/grace")
    assert "password" not in user_resp.json()
    assert "password_hash" not in user_resp.json()
