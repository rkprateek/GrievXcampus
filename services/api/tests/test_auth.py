from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password, verify_password
from app.models import Role, User
from tests.conftest import TestingSessionLocal


def test_register_login_and_me(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={
            "name": "Test Student",
            "email": "student@example.com",
            "password": "StrongPass123!",
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["role"] == "student"
    assert payload["email"] == "student@example.com"
    assert "password" not in payload
    assert "password_hash" not in payload

    duplicate = client.post(
        "/auth/register",
        json={
            "name": "Test Student",
            "email": "student@example.com",
            "password": "StrongPass123!",
        },
    )
    assert duplicate.status_code == 409

    login = client.post(
        "/auth/login",
        json={"email": "student@example.com", "password": "StrongPass123!"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert token

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "student@example.com"
    assert me.json()["role"] == "student"
    assert "password_hash" not in me.text


def test_password_is_hashed_and_validated() -> None:
    hashed = hash_password("StrongPass123!")
    assert hashed != "StrongPass123!"
    assert verify_password("StrongPass123!", hashed) is True
    assert verify_password("WrongPass123!", hashed) is False


def test_invalid_and_unknown_logins_are_rejected(client: TestClient) -> None:
    client.post(
        "/auth/register",
        json={
            "name": "Test Student",
            "email": "invalid-login@example.com",
            "password": "StrongPass123!",
        },
    )

    response = client.post(
        "/auth/login",
        json={"email": "invalid-login@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401

    missing_user = client.post(
        "/auth/login",
        json={"email": "missing@example.com", "password": "StrongPass123!"},
    )
    assert missing_user.status_code == 401


def test_me_requires_valid_jwt(client: TestClient) -> None:
    missing = client.get("/auth/me")
    assert missing.status_code == 401

    invalid = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert invalid.status_code == 401


def test_inactive_user_is_rejected(client: TestClient) -> None:
    with TestingSessionLocal() as db:
        student_role = db.query(Role).filter(Role.name == "student").one()
        user = User(
            name="Inactive User",
            email="inactive@example.com",
            password_hash=hash_password("StrongPass123!"),
            role_id=student_role.id,
            is_active=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id)
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_student_cannot_access_admin_endpoint(client: TestClient) -> None:
    client.post(
        "/auth/register",
        json={
            "name": "Another Student",
            "email": "student-admin-test@example.com",
            "password": "StrongPass123!",
        },
    )
    login = client.post(
        "/auth/login",
        json={
            "email": "student-admin-test@example.com",
            "password": "StrongPass123!",
        },
    )
    token = login.json()["access_token"]

    response = client.get(
        "/auth/admin-check",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_authorized_admin_can_access_admin_endpoint(client: TestClient) -> None:
    with TestingSessionLocal() as db:
        admin_role = db.query(Role).filter(Role.name == "admin").one()
        admin_user = User(
            name="Admin User",
            email="admin@example.com",
            password_hash=hash_password("StrongPass123!"),
            role_id=admin_role.id,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

    token = create_access_token(admin_user.id)
    response = client.get(
        "/auth/admin-check",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"].startswith("Admin access confirmed")
