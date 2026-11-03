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
Implementation added on the week-3-auth-rbac branch.

### Completed
- Added users and roles SQLAlchemy models.
- Added Student, Staff, Department Head, and Admin roles.
- Added password hashing with Argon2 through pwdlib.
- Added JWT access-token creation and validation.
- Added registration, login and current-user endpoints.
- Added backend role-based authorization.
- Added Admin-only RBAC verification.
- Added Alembic migration 0002_auth_rbac.
- Added authentication and RBAC tests.

### Security boundary
Public registration always creates a Student account. Privileged roles are not user-selectable during registration.

## Week 4

### Status
Student complaint submission and the student mobile demo were implemented on the Week 4 branches.

### Completed
- Added complaints and complaint images.
- Added student-only complaint creation/list/detail access.
- Added ownership enforcement.
- Added image selection/upload with MIME and 5 MB validation.
- Added Supabase Auth, PostgreSQL and private Storage for the current student demo.
- Added Stitch-inspired student mobile screens.
- Removed GPS/location detection; complaint location is manual campus text only.
- Added login, register, report issue, complaint list/detail and profile flows.
- Added Week 4 security hardening and Supabase RLS.

### Scope control
Week 4 did not implement ML classification, priority prediction, department routing, automated duplicate detection, analytics, campus map or deployment.

## Week 5

### Status
Admin complaint-management foundation implemented on the week-5-admin-dashboard branch.

### Completed
- Added a Next.js + TypeScript admin dashboard.
- Added administrator sign-in using Supabase Auth.
- Added admin role enforcement before showing complaint management.
- Added complaint search and lifecycle filters.
- Added complaint detail panel with student, location, description and submission time.
- Added lifecycle status updates.
- Added dashboard counts for total, new, active and resolved/closed complaints.
- Added departments table and starter campus departments.
- Added staff assignment data model for the upcoming assignment workflow.
- Added complaint priority field foundation (normal, high, critical).
- Added Supabase RLS policies for staff/admin complaint access.
- Added profile role-escalation protection so normal users cannot change their own role.
- Added database indexes for department, priority and assignment lookups.

### Scope control
Week 5 is limited to admin complaint management and its database/security foundation. Automated department routing, ML priority prediction, notifications, analytics, campus map and deployment remain in later roadmap weeks.

### Verification
The Supabase migrations were applied successfully to the connected GrievX Campus project. The Next.js admin app has been committed to the GitHub branch; local npm install, npm run typecheck and npm run build should be run in VS Code before marking Week 5 fully verified.
