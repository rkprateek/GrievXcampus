# GrievX Campus — Department Portal

## Administrator setup

1. Sign in to the main administrator dashboard.
2. Open /staff.
3. Assign each existing department head and staff account to the correct department.
4. Ensure the user has the department_head or staff role in the profiles table.
5. The administrator can monitor all department activity at /department-activity.

## Department login

Open /department. Department heads and staff sign in directly with their Supabase email and password. The portal checks the authenticated profile and assigned department before loading complaints.

## Department-head workspace

Department heads see complaints routed to their assigned department. They can review complaint details, priority and ML confidence, and update permitted lifecycle statuses. They do not need administrator approval to receive or work on automatically routed complaints.

## Staff workspace

Staff accounts are restricted by database policies to complaints assigned to their staff account. They can update only the permitted lifecycle fields.

## Access rules

- Administrators retain campus-wide operational access.
- Department heads are scoped to their assigned department.
- Staff members are scoped to their assigned complaints.
- Complaint evidence and assignment history follow the same complaint access check.
- Students retain their own complaint access and cannot use these workspaces.

Supabase RLS is the actual access boundary. Review and apply the scoped staff-access migration before using the portal against a shared database. Apply the automatic-routing migration separately as described in docs/automatic-routing-and-department-portal.md.
