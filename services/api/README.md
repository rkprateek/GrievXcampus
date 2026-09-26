# GrievX Campus API

FastAPI backend for GrievX Campus.

## Week 3 authentication and RBAC

Implemented:
- PostgreSQL-backed users and roles
- Four roles: student, staff, department_head, admin
- Argon2 password hashing through pwdlib
- JWT access-token creation and validation with exp/iat claims
- POST /auth/register
- POST /auth/login
- GET /auth/me
- Backend role dependency enforcement via `get_current_user()` and `require_roles(...)`
- GET /auth/admin-check as an RBAC verification endpoint
- Alembic migration that creates roles/users and seeds the four roles
- Isolated SQLite API test fixtures for authentication tests

Registration always creates a Student account. Staff, Department Head, and Admin role assignment is intentionally not exposed through public registration.

No complaint submission, lifecycle, notification, ML, or other Week 4 features have been implemented in this branch.

### JWT and security notes
- JWT secret and expiration settings are loaded from application configuration/environment values.
- Development defaults are intentionally local-only and should be overridden in a real deployment.
- Passwords are never stored in plaintext. They are hashed with Argon2 before persistence.
- Protected endpoints require a valid Bearer token and the correct role.

### Testing and migration commands

```bash
cd services/api
pytest
alembic upgrade head
```

### Week 3 API endpoints

- POST /auth/register
- POST /auth/login
- GET /auth/me
- GET /auth/admin-check (protected admin verification endpoint)

### Security boundary
Privileged roles are backend-controlled and are not accepted from public registration requests.

## Week 2 foundation

Implemented:
- FastAPI application entry point
- environment-backed settings
- SQLAlchemy engine/session dependency
- database declarative base and timestamp mixin
- Alembic migration configuration and baseline revision
- GET /health database connectivity check
- common application error response shape
- pytest foundation

## Run locally

From services/api:

```bash
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
pip install -e ".[test]"
uvicorn app.main:app --reload
```

The API expects PostgreSQL from the root Docker Compose file.

Database migrations:

```bash
alembic upgrade head
```

Tests:

```bash
pytest
```

Authentication flow:

1. Register with POST /auth/register.
2. Login with POST /auth/login.
3. Send the returned token as `Authorization: Bearer <token>`.
4. Call GET /auth/me or protected endpoints.
5. RBAC dependencies reject users whose role is not allowed.
