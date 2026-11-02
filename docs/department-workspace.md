# GrievX Campus — Staff and Department Workspaces

## Admin setup

1. Sign in to the main admin dashboard using an administrator account.
2. Open the staff directory at /staff.
3. Assign each staff member and department head to the correct department.
4. Confirm that staff accounts are assigned to the appropriate complaint records through the admin complaint workflow.

## Staff workspace

Open /department after signing in. Staff users can view and update complaints assigned to their own account. The database policies are the access boundary; the page does not rely on client-side filtering for privacy.

## Department-head workspace

Open /department after signing in. Department heads can view complaints belonging to the department assigned to their profile and update permitted complaint states. An administrator must assign a department to the department-head profile before the department view is populated.

## Access rules

- Administrators retain campus-wide operational access.
- Department heads are scoped to their assigned department.
- Staff members are scoped to complaints assigned to their staff account.
- Complaint evidence and assignment history follow the same complaint access check.
- Students retain their own complaint access and cannot use these workspaces.

The Week 13 scoped-access migration must be reviewed and applied before using these routes against a shared Supabase project. Run the final authorization tests before production use.