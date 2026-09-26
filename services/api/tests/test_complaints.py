from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.models import Role, User
from tests.conftest import TestingSessionLocal


def register_student(client: TestClient, email: str = "student@example.com") -> str:
    response = client.post(
        "/auth/register",
        json={
            "name": "Test Student",
            "email": email,
            "password": "StrongPass123!",
        },
    )
    assert response.status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": email, "password": "StrongPass123!"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


def test_student_can_create_and_list_own_complaints(client: TestClient) -> None:
    token = register_student(client)
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/complaints",
        headers=headers,
        json={
            "title": "Broken classroom fan",
            "description": "The ceiling fan is not working.",
            "location": "Block A, Room 204",
        },
    )
    assert create.status_code == 201
    complaint = create.json()
    assert complaint["status"] == "submitted"
    assert complaint["title"] == "Broken classroom fan"
    assert complaint["images"] == []

    listed = client.get("/complaints", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == complaint["id"]


def test_unauthenticated_cannot_create_complaint(client: TestClient) -> None:
    response = client.post(
        "/complaints",
        json={
            "title": "Broken light",
            "description": "The light is not working.",
            "location": "Library",
        },
    )
    assert response.status_code == 401


def test_non_student_cannot_create_complaint(client: TestClient) -> None:
    with TestingSessionLocal() as db:
        admin_role = db.query(Role).filter(Role.name == "admin").one()
        user = User(
            name="Admin",
            email="admin-complaint@example.com",
            password_hash=hash_password("StrongPass123!"),
            role_id=admin_role.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id)
    response = client.post(
        "/complaints",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Should fail",
            "description": "Admin cannot submit student complaints.",
            "location": "Block A",
        },
    )
    assert response.status_code == 403


def test_invalid_complaint_values_are_rejected(client: TestClient) -> None:
    token = register_student(client)
    response = client.post(
        "/complaints",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": " ", "description": " ", "location": " "},
    )
    assert response.status_code == 422


def test_student_cannot_access_another_students_complaint(client: TestClient) -> None:
    first_token = register_student(client, "first@example.com")
    first_create = client.post(
        "/complaints",
        headers={"Authorization": f"Bearer {first_token}"},
        json={
            "title": "First complaint",
            "description": "Owned by first student.",
            "location": "Block A",
        },
    )
    complaint_id = first_create.json()["id"]

    second_token = register_student(client, "second@example.com")
    response = client.get(
        f"/complaints/{complaint_id}",
        headers={"Authorization": f"Bearer {second_token}"},
    )
    assert response.status_code == 404


def test_student_complaint_detail_includes_images(client: TestClient, monkeypatch) -> None:
    token = register_student(client)
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/complaints",
        headers=headers,
        json={
            "title": "Broken projector",
            "description": "Projector does not power on.",
            "location": "Lab 1",
        },
    )
    complaint_id = create.json()["id"]

    class FakeStorage:
        def upload_image(self, content: bytes, content_type: str, filename: str) -> str:
            assert content == b"fake-image"
            return f"complaints/{uuid4()}.png"

    import app.api.routes.complaints as complaints_route

    monkeypatch.setattr(complaints_route, "get_object_storage", lambda: FakeStorage())

    upload = client.post(
        f"/complaints/{complaint_id}/images",
        headers=headers,
        files={"file": ("photo.png", b"fake-image", "image/png")},
    )
    assert upload.status_code == 201
    assert upload.json()["content_type"] == "image/png"

    detail = client.get(f"/complaints/{complaint_id}", headers=headers)
    assert detail.status_code == 200
    assert len(detail.json()["images"]) == 1


def test_invalid_image_type_is_rejected(client: TestClient, monkeypatch) -> None:
    token = register_student(client)
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/complaints",
        headers=headers,
        json={
            "title": "Broken screen",
            "description": "Screen is damaged.",
            "location": "Block B",
        },
    )
    complaint_id = create.json()["id"]

    import app.api.routes.complaints as complaints_route

    def fail_if_called():
        raise AssertionError("Storage must not be called for an invalid content type.")

    monkeypatch.setattr(complaints_route, "get_object_storage", fail_if_called)

    response = client.post(
        f"/complaints/{complaint_id}/images",
        headers=headers,
        files={"file": ("notes.txt", b"not-an-image", "text/plain")},
    )
    assert response.status_code == 415
