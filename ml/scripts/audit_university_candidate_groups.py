"""Audit candidate records for paraphrase/group duplication before training.

Run from the repository root:
    python -m ml.scripts.audit_university_candidate_groups

Reads only the mapped training CSV and prints group-level counts. It does not
change data or remove rows.
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


def main() -> None:
    if not MAPPED_FILE.exists():
        raise FileNotFoundError(
            f"Missing {MAPPED_FILE}. Run the preparation script first."
        )

    with MAPPED_FILE.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    candidates = [r for r in rows if r.get("mapping_status") == "candidate"]
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in candidates:
        group_id = (row.get("Complaint_Group_ID") or "").strip()
        if not group_id:
            group_id = f"missing-group-row-{row.get('ID', '')}"
        groups[group_id].append(row)

    print("CANDIDATE GROUP AUDIT")
    print(f"Candidate rows: {len(candidates)}")
    print(f"Candidate complaint groups: {len(groups)}")
    print(f"Rows beyond one-per-group: {sum(max(0, len(v) - 1) for v in groups.values())}")

    sizes = Counter(len(items) for items in groups.values())
    print("\nGROUP SIZE DISTRIBUTION")
    for size, count in sorted(sizes.items()):
        print(f"Groups with {size} candidate row(s): {count}")

    category_groups: dict[str, set[str]] = defaultdict(set)
    conflicts: list[tuple[str, list[str], list[dict[str, str]]]] = []
    for group_id, items in groups.items():
        labels = sorted({r.get("grievx_candidate_category", "") for r in items})
        for label in labels:
            category_groups[label].add(group_id)
        if len(labels) > 1:
            conflicts.append((group_id, labels, items))

    print("\nUNIQUE GROUPS PER CANDIDATE CATEGORY")
    for label, group_ids in sorted(category_groups.items()):
        print(f"{label}: {len(group_ids)}")

    print("\nGROUPS WITH CONFLICTING CANDIDATE LABELS")
    if not conflicts:
        print("None")
    for group_id, labels, items in conflicts:
        print(f"Group {group_id}: {' | '.join(labels)}")
        for row in items:
            print(
                f"  [{row.get('grievx_candidate_category')}] "
                f"{row.get('Complaint_Description', '')}"
            )

    print("\nLARGEST PARAPHRASE GROUPS")
    largest = sorted(groups.items(), key=lambda pair: (-len(pair[1]), pair[0]))[:15]
    for group_id, items in largest:
        labels = sorted({r.get("grievx_candidate_category", "") for r in items})
        print(f"Group {group_id} | rows={len(items)} | labels={', '.join(labels)}")
        for row in items[:3]:
            print(f"  {row.get('Complaint_Description', '')}")

    print("\nNo rows were deleted, rewritten, or added to training.")
    print("Use group-level counts—not raw row counts—to judge independent examples.")


if __name__ == "__main__":
    main()
