# Weekly Report

## Week 1

### Status
Foundation completed on the week-1-foundation branch and submitted as PR #1.

### Completed
- Created the GrievX Campus repository foundation.
- Defined the 14-week development roadmap.
- Defined the architecture and technology boundaries.
- Added local PostgreSQL, Redis, and MinIO infrastructure configuration.
- Added project development and security rules.
- Added detailed requirements.
- Added roles and permissions matrix.
- Added planned API design.
- Added planned database design.
- Added student mobile and admin dashboard UI flows.
- Added application, backend and ML project shells.
- Added environment variable template.
- Documented Duplicate Detection as an application feature, separate from the three ML capabilities.

## Week 2

### Status
Implemented and locally verified in the developer environment.

### Completed
- Created the FastAPI application entry point.
- Added environment-backed application configuration with Pydantic Settings.
- Added SQLAlchemy engine/session infrastructure.
- Added the shared declarative database base and timestamp defaults.
- Added Alembic configuration and a Week 2 baseline migration.
- Added GET /health with a database connectivity check.
- Added a common application error response structure.
- Added pytest configuration and root/health API tests.
- Fixed API packaging discovery for the flat Alembic/app layout.
- Verified PostgreSQL connectivity and Alembic migration locally.

### Scope control
Week 2 intentionally did not implement complaint APIs, complaint lifecycle, notifications, ML inference, duplicate detection, analytics, map features, or deployment.

## Week 3

### Status
Implementation added on the `week-3-auth-rbac` branch. Local runtime verification is still required after syncing the branch.

### Completed
- Added users and roles SQLAlchemy models.
- Added Student, Staff, Department Head, and Admin roles.
- Added password hashing with Argon2 through pwdlib.
- Added JWT access-token creation and validation.
- Added registration and login endpoints.
- Added authenticated current-user endpoint.
- Added backend role-based authorization dependency.
- Added an Admin-only RBAC verification endpoint.
- Added Alembic migration `0002_auth_rbac` with role seed data.
- Added authentication and RBAC API tests with an isolated SQLite test database.
- Kept complaint, ML, notification, analytics, map, and deployment work outside Week 3 scope.

### Security boundary
Public registration always creates a Student account. Privileged roles are not user-selectable during registration.

### Verification
The connected GitHub environment was used to inspect and modify the repository, but it does not execute the project's local Python/Docker test environment. Run the Week 3 test suite and PostgreSQL migration locally before marking Week 3 complete.

### Next
Verify Week 3 locally, then proceed to Week 4 complaint submission only after authentication and RBAC are passing.
