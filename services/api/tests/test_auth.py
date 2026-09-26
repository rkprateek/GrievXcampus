from fastapi.testclient import TestClient

from app.main import app


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
    assert response.json()["role"] == "student"

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

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "student@example.com"
    assert me.json()["role"] == "student"


def test_invalid_login_is_rejected(client: TestClient) -> None:
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
