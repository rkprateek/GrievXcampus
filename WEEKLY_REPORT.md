# Weekly Report

## Week 1

### Status
In progress.

### Completed
- Created the GrievX Campus repository.
- Defined the initial project scope.
- Defined the 14-week development roadmap.
- Defined the initial architecture.
- Added local PostgreSQL, Redis, and MinIO infrastructure configuration.
- Added project development and security rules.
- Added the new duplicate complaint detection feature to the product scope and roadmap.
- Defined the duplicate detection submission flow and the hostel leakage acceptance scenario.

### Duplicate detection requirement

The system must identify the two following complaints as a possible duplicate because they describe a similar water-leakage issue at the same hostel location:

1. **Water leaking from ceiling pipe** — Boys Hostel 1, 3rd Floor — Continuous water leaking and pooling on the floor.
2. **Ceiling pipe leakage in hostel** — Boys Hostel 1, 3rd Floor — Water dripping from pipe on the 3rd floor.

The system should show the existing complaint to the student before allowing the new complaint to be submitted.

### Verification
The requirement is documented. Implementation and automated testing are scheduled for Week 10.

### Next
Complete the remaining Week 1 requirements, role definitions, wireframes, API/database planning, and initial application structure.
