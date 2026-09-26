# GrievX Campus API

FastAPI backend for GrievX Campus.

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

Not implemented in Week 2:
- authentication/JWT/RBAC
- complaint APIs
- complaint lifecycle
- notifications
- ML inference
- duplicate detection

## Run locally

From services/api:

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -e ".[test]"
uvicorn app.main:app --reload
```

The API expects PostgreSQL from the root Docker Compose file.

Database migrations:

```bash
alembic upgrade head
```
