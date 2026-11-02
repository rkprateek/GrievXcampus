# GrievX Campus — Final Test Plan

Execute this plan after the implementation review. A test is passed only after it has actually been run and its result recorded.

## Backend and database
- Run the FastAPI test suite and apply the database migrations in order.
- Verify health/database connectivity, registration, login, JWT expiry, role checks, complaint ownership, image uploads, ML endpoints and routing fallback.

## Admin dashboard
- Run the admin TypeScript check and production build.
- Verify admin sign-in, complaint search/filter/detail, status/priority/department changes, staff assignment, analytics, CSV export, campus heatmap, staff directory and department workspace links.

## Student mobile app
- Run the mobile TypeScript check and launch the Expo app on an Android emulator or device.
- Verify registration/login, persistent session, complaint creation, manual location, image upload, complaint list/details, duplicate warning, submit-anyway path, upvoting, notifications and status history.

## Supabase authorization matrix
- Student A can access only Student A's permitted records.
- Student B cannot access Student A's complaint, evidence, notifications or votes.
- Staff can access only complaints assigned to their account and can update lifecycle status only.
- Department heads can access only their assigned department and assign only staff belonging to that department.
- Administrators retain campus-wide complaint and staff-management access.
- Evidence and assignment-history policies follow the same complaint scope.

Review and apply migration 202611030002_week_13_scoped_staff_access.sql before running this matrix.

## Upload and security cases
- Valid JPEG, PNG and WebP uploads are accepted within the 5 MB limit.
- Empty, unsupported, spoofed-MIME and oversized uploads are rejected.
- Production configuration rejects placeholders, wildcard CORS/hosts, local database URLs and non-HTTPS object-storage endpoints.
- Production API docs and OpenAPI schema are disabled.
- Untrusted Host headers are rejected and security response headers are present.
- No backend secrets appear in client bundles, Git history or logs.

## End-to-end complaint lifecycle
1. Student submits a complaint with manual location and optional image.
2. Similar complaint is flagged; student reviews the existing ticket or explicitly submits anyway.
3. ML predicts category, priority and department; low-confidence routing falls back to manual review.
4. Complaint remains submittable when the optional ML service is unavailable.
5. Admin assigns department and staff; the assigned staff account can see the ticket.
6. Staff updates status; history and student notification are created.
7. Department head sees only the department's complaints.
8. Admin reviews analytics, exports CSV and views the manual-location heatmap.

## Deployment readiness
- Build the API container and verify its health check and non-root runtime.
- Configure production environment values and exact allowed origins/hosts.
- Verify managed database connectivity, private evidence storage, backups, logs, alerts and provider-level rate limits.
- Demonstrate backup restoration before public launch.

## Results record
For each check, record date, environment, exact scenario, expected result, actual result, pass/fail and evidence reference. Do not invent model metrics or mark unexecuted checks as passed.