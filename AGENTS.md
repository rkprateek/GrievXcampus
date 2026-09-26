# GrievX Campus Development Rules

## Scope control

- Work only on the requested week.
- Inspect the existing implementation before changing it.
- Do not start later-week features early.
- Do not claim a feature is complete without verification.

## Architecture

- Mobile: React Native + Expo + TypeScript.
- Admin: Next.js + TypeScript.
- Backend: FastAPI + Pydantic + SQLAlchemy + Alembic.
- Database: PostgreSQL.
- Cache/realtime support: Redis.
- Object storage: MinIO locally and S3-compatible storage in production.
- ML: Python with reproducible training and evaluation.

## Security

- Never commit secrets.
- Keep credentials in environment variables.
- Hash passwords; never store plaintext passwords.
- Enforce authentication and role-based authorization on protected APIs.
- Validate uploaded files and request data.
- Do not expose sensitive user information unnecessarily.

## ML

The planned ML scope is text classification, priority prediction, and department routing. Metrics must come from actual experiments on the project's data and must not be copied from reference papers.

## Verification

Every weekly implementation should include appropriate automated tests and a manual verification checklist where UI or integration behavior is involved.
