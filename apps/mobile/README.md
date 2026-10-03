# GrievX Campus Mobile

React Native + Expo student application.

## Week 4 implementation

The Week 4 mobile flow includes:
- Student registration and login using Supabase Auth.
- Persistent Supabase session storage using AsyncStorage.
- Student home screen.
- New Complaint form.
- Title, description and location fields.
- Image selection, preview and Supabase Storage upload.
- Complaint submission to Supabase PostgreSQL.
- My Complaints list.
- Complaint details.
- Loading and error states.

## Local development

This project uses Expo SDK 57 with React Native 0.86.3. Expo SDK 57 was released on June 30, 2026.

Install:

    cd apps/mobile
    npm install

When using a physical Android device, set the API URL to the computer's LAN address instead of localhost:

    $env:EXPO_PUBLIC_API_BASE_URL="http://YOUR_COMPUTER_IP:8000"

Start:

    npm start

Type check:

    npm run typecheck

## Scope boundary

The mobile app does not implement admin dashboard features, staff assignment, department routing, complaint status changes, notifications, ML features, duplicate detection, analytics or campus map features. Those belong to later roadmap weeks.
