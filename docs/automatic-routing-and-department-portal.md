# Automatic routing and Department Portal

## Routing behavior
1. A student submits a complaint.
2. FastAPI predicts category and priority from the title and description.
3. The category router maps the prediction to an existing department code.
4. The authenticated mobile app calls the Supabase prediction RPC.
5. The RPC persists prediction metadata and assigns the complaint to its department.
6. An unavailable ML service or invalid department code falls back automatically to the seeded General department (GEN). Complaint submission does not wait for admin approval.
7. Each successful workflow writes a prediction-history row.

The General fallback is an automatic safety net. Admins can monitor and correct exceptions but do not approve routine routing.

## Department Portal
- Route: /department
- Authentication: Supabase email/password.
- Allowed roles: department_head, staff and admin.
- Department heads and staff must be assigned to a department by an administrator.
- RLS is the security boundary; client-side filtering is not treated as authorization.
- Department users can update complaint lifecycle status within database permissions.

## Admin dashboard
The main admin queue remains campus-wide. The /staff page assigns department membership. The campus heatmap is out of scope and must not be presented as a project feature.

## Database migration
After pulling this branch, review and apply:
supabase/migrations/202611240001_automatic_ml_routing_and_history.sql

Verify that the seeded General department exists with code GEN before running the migration. Never put a Supabase service-role key in the mobile or admin app.

## Verification
- Test representative complaints for every category and verify department code mapping.
- Test safety phrases for critical priority.
- Test unfamiliar text and ML-service outage; both must route to General automatically.
- Confirm every submission persists category, priority, department and prediction history.
- Sign in as department_head and confirm only that department's complaints are visible.
- Update a complaint in /department and confirm the main admin dashboard shows the new status.
