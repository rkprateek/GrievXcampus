import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB = Path(__file__).with_name("test_grievx.db")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{TEST_DB.as_posix()}"

from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, RoleName  # noqa: E402

engine = create_engine(
    os.environ["DATABASE_URL"],
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as db:
        db.add_all(
            [
                Role(name=RoleName.STUDENT.value),
                Role(name=RoleName.STAFF.value),
                Role(name=RoleName.DEPARTMENT_HEAD.value),
                Role(name=RoleName.ADMIN.value),
            ]
        )
        db.commit()

    yield

    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    try:
        if TEST_DB.exists():
            TEST_DB.unlink()
    except PermissionError:
        pass


@pytest.fixture
def client() -> TestClient:
    def override_get_db():
        with TestingSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
