# GrievX Campus

GrievX Campus is a campus complaint and incident management platform with a student mobile application, an operations/admin web dashboard, a FastAPI backend, PostgreSQL, Redis, object storage, and a focused ML pipeline.

## Project goal

Provide a structured way for students to submit campus complaints and for authorized campus staff to manage, assign, track, and resolve them.

## Core features

- Student complaint submission with title, description, location, and optional image.
- Complaint history and status tracking.
- Admin/staff complaint management and assignment.
- **Duplicate complaint detection** before a new complaint is created.
- Notifications and operational updates.
- Analytics and campus operational views.

### Duplicate complaint detection

When a student submits a complaint, the system checks recent existing complaints for a likely duplicate using:

1. Title similarity.
2. Description similarity.
3. Location matching.
4. A configurable similarity threshold.

For example:

**Existing complaint**
- Title: Water leaking from ceiling pipe
- Location: Boys Hostel 1, 3rd Floor
- Description: Continuous water leaking and pooling on the floor.

**New complaint**
- Title: Ceiling pipe leakage in hostel
- Location: Boys Hostel 1, 3rd Floor
- Description: Water dripping from pipe on the 3rd floor.

Because the wording and location describe the same issue, the system should flag the new submission as a **possible duplicate** and show the student the existing complaint instead of silently creating another duplicate record.

The student should be able to review the existing complaint and either:
- open/follow the existing complaint, or
- continue submitting if they confirm it is a different issue.

The detection feature is separate from the three planned ML capabilities and must not be described as an additional ML model.

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
