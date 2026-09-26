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
- Added JWT access-token creation and validation with subject, issued-at, and expiration claims.
- Added registration and login endpoints.
- Added authenticated current-user endpoint.
- Added backend role-based authorization dependency.
- Added an Admin-only RBAC verification endpoint.
- Added Alembic migration `0002_auth_rbac` with role seed data.
- Added authentication and RBAC API tests with an isolated SQLite test database.
- Verified missing, malformed, expired, and inactive token handling behavior.
- Kept complaint, ML, notification, analytics, map, deployment, and all Week 4 functionality outside Week 3 scope.

### Explicit scope note
Week 4 complaint submission and complaint-related functionality were not started in this branch.

### Security boundary
Public registration always creates a Student account. Privileged roles are not user-selectable during registration.

### Verification
The connected GitHub environment was used to inspect and modify the repository, but it does not execute the project's local Python/Docker test environment. Run the Week 3 test suite and PostgreSQL migration locally before marking Week 3 complete.

### Next
Verify Week 3 locally, then proceed to Week 4 complaint submission only after authentication and RBAC are passing.


## Week 4

### Status
Student complaint submission implementation added on the week-4-complaint-submission branch.

### Completed
- Added Complaint and ComplaintImage database models.
- Added Alembic migration 0003_complaints.
- Added student-only complaint creation.
- Added authenticated student complaint listing.
- Added authenticated student complaint detail access with ownership enforcement.
- New complaints start in SUBMITTED status.
- Added MinIO/S3-compatible image upload.
- Added image MIME-type and 5 MB size validation.
- Added complaint image metadata persistence.
- Added React Native + Expo student login/register flow using the existing Week 3 authentication API.
- Added secure JWT storage using Expo SecureStore.
- Added New Complaint, My Complaints and Complaint Details screens.
- Added image selection and preview.
- Added Week 4 backend tests for authentication, authorization, ownership, validation and image handling.
- Updated API and database documentation.

### Scope control
Week 4 intentionally did not implement admin complaint management, staff assignment, department routing, status transitions, notifications, text classification, priority prediction, duplicate detection, analytics, campus map or deployment.

### Verification
The repository changes were implemented on the week-4-complaint-submission branch. Local pytest, PostgreSQL migration and mobile npm/typecheck commands must be run in the user's VS Code environment before this week is marked fully verified.
