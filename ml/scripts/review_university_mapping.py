"""Print a human-review report for the mapped external training split.

Run from the repository root:
    python -m ml.scripts.review_university_mapping

This report reads only train_mapped.csv. It does not change any files or train models.
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path

MAPPED_FILE = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "external"
    / "university_students_complaints"
    / "mapped"
    / "train_mapped.csv"
)
MAX_EXAMPLES_PER_CATEGORY = 5
MAX_REVIEW_EXAMPLES = 15


def main() -> None:
    if not MAPPED_FILE.exists():
        raise FileNotFoundError(
            f"Missing {MAPPED_FILE}. Run python -m ml.scripts.prepare_university_dataset first."
        )

    with MAPPED_FILE.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    candidates = [row for row in rows if row.get("mapping_status") == "candidate"]
    review = [row for row in rows if row.get("mapping_status") == "review"]
    excluded = [row for row in rows if row.get("mapping_status") == "excluded"]

    print("TRAIN SPLIT MAPPING STATUS")
    print(f"Total source training rows: {len(rows)}")
    print(f"Candidate: {len(candidates)}")
    print(f"Needs review: {len(review)}")
    print(f"Excluded: {len(excluded)}")

    print("\nCANDIDATE CATEGORY COUNTS")
    for category, count in sorted(
        Counter(row["grievx_candidate_category"] for row in candidates).items()
    ):
        print(f"{category}: {count}")

    print("\nCANDIDATE COUNTS BY ORIGINAL SOURCE CATEGORY")
    source_categories = sorted({row.get("Category", "") for row in candidates})
    candidate_categories = sorted(
        {row.get("grievx_candidate_category", "") for row in candidates}
    )
    for source_category in source_categories:
        print(f"\n{source_category}:")
        subset = [
            row for row in candidates if row.get("Category") == source_category
        ]
        for candidate_category, count in sorted(
            Counter(row["grievx_candidate_category"] for row in subset).items()
        ):
            print(f"  {candidate_category}: {count}")

    print("\nCANDIDATE EXAMPLES (UP TO 5 PER GRIEVX CATEGORY)")
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in candidates:
        grouped[row["grievx_candidate_category"]].append(row)

    for category in sorted(grouped):
        print(f"\n### {category}")
        for row in grouped[category][:MAX_EXAMPLES_PER_CATEGORY]:
            print(f"Source category: {row.get('Category', '')}")
            print(f"Source department: {row.get('Primary_Department', '')}")
            print(f"Source severity: {row.get('Severity', '')}")
            print(f"Group ID: {row.get('Complaint_Group_ID', '')}")
            print(f"Complaint: {row.get('Complaint_Description', '')}")
            print(f"Mapping reason: {row.get('mapping_reason', '')}")
            print("-" * 60)

    print("\nAMBIGUOUS REVIEW EXAMPLES")
    for row in review[:MAX_REVIEW_EXAMPLES]:
        print(f"Source category: {row.get('Category', '')}")
        print(f"Candidate labels: {row.get('grievx_candidate_category', '')}")
        print(f"Complaint: {row.get('Complaint_Description', '')}")
        print(f"Mapping reason: {row.get('mapping_reason', '')}")
        print("-" * 60)

    print("\nNo source rows were changed. No records were added to model training.")
    print("Review candidate precision before approving any mapping rule.")


if __name__ == "__main__":
    main()
