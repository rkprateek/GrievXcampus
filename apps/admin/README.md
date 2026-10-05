# GrievX Campus Admin Dashboard

Week 5 admin web dashboard built with Next.js, TypeScript and Supabase.

## Current scope

- Administrator email/password sign-in.
- Role check against `public.profiles.role`.
- Complaint list with search and lifecycle filters.
- Complaint detail view.
- Complaint status updates.
- Summary counts for total, new, active and resolved/closed complaints.
- Supabase Row Level Security for staff/admin complaint access.
- Departments and staff-assignment database foundation for later routing/assignment work.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Put the Supabase publishable key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

The admin account must already exist in Supabase Auth and its matching `public.profiles.role` must be `admin`. Public student registration never creates an admin account.

## Week 5 boundary

This dashboard manages the current complaint lifecycle. Automated department routing, ML priority prediction, notifications and analytics remain in their later roadmap weeks.
