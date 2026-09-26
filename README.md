# GrievX Campus

GrievX Campus is a campus complaint and incident management platform with a student mobile application, an operations/admin web dashboard, a FastAPI backend, PostgreSQL, Redis, object storage, and a focused ML pipeline.

## Project goal

Provide a structured way for students to submit campus complaints and for authorized campus staff to manage, assign, track, and resolve them.

## ML scope

The ML pipeline is intentionally limited to:

1. Text classification
2. Priority prediction
3. Department routing

No ML feature is assumed to work until it is implemented, tested, and evaluated on project data.

## Applications

- `apps/mobile` — React Native + Expo + TypeScript student application
- `apps/admin` — Next.js + TypeScript admin/staff dashboard
- `services/api` — FastAPI backend
- `ml` — ML experiments, training, evaluation, and model artifacts

## Infrastructure

- PostgreSQL
- Redis
- S3-compatible object storage (MinIO for local development)
- Docker Compose for local infrastructure

## Development approach

The project is developed in 14 controlled weeks. Each week has a defined scope, tests, documentation updates, and a verification checkpoint. Work from a later week should not be started until the current week's scope is verified.

See `docs/14-week-roadmap.md` for the complete plan.
