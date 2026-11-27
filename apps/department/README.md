# GrievX Department Portal

A standalone Next.js application for department heads and staff. It shares the existing GrievX Supabase project with the student app and admin website.

## Local setup

1. Open a terminal in `apps/department`.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Fill in the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` values used by the admin app.
5. Start the app: `npm run dev`.
6. Open http://localhost:3000.

## Access

Sign in using an account created by the GrievX administrator. Only profiles with role `department_head` or `staff` and a valid `department_id` are admitted. The portal queries complaints for that department only. Supabase Row Level Security remains responsible for enforcing data access.

## Deploy separately

Create a separate Vercel project using the same Git repository and set the Root Directory to `apps/department`. Add the two Supabase environment variables in Vercel. The admin website remains in `apps/admin` and is not changed by this application.
