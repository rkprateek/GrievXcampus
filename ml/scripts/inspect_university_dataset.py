"""Download and audit the public university complaint dataset.

Run from the repository root:
    python -m ml.scripts.inspect_university_dataset

Raw source files are saved under ml/data/external/university_students_complaints/.
They are intentionally not merged into the GrievX training CSV by this script.
"""
from __future__ import annotations

import csv
import io
import urllib.request
from collections import Counter
from pathlib import Path

BASE_URL = (
    "https://huggingface.co/datasets/alaminxpro/"
    "university-students-complaints/resolve/main"
)
DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "external" / "university_students_complaints"
SPLITS = ("train", "test")
REQUIRED_COLUMNS = {
    "Complaint_Description",
    "Category",
    "Primary_Department",
    "Severity",
    "Complaint_Group_ID",
}


def download_split(split: str) -> list[dict[str, str]]:
    url = f"{BASE_URL}/{split}.csv"
    request = urllib.request.Request(url, headers={"User-Agent": "GrievX-ML-Dataset-Audit/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            content = response.read()
    except Exception as exc:
        raise RuntimeError(
            f"Could not download {split}.csv from Hugging Face. "
            "Check internet access and try again. Original error: " + str(exc)
        ) from exc

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / f"{split}.csv").write_bytes(content)
    try:
        text = content.decode("utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(text)))
    except Exception as exc:
        raise RuntimeError(f"Could not parse {split}.csv: {exc}") from exc

    if not rows:
        raise RuntimeError(f"The downloaded {split}.csv contains no data rows.")
    missing = REQUIRED_COLUMNS - set(rows[0])
    if missing:
        raise RuntimeError(
            f"Unexpected {split}.csv schema. Missing columns: {sorted(missing)}. "
            f"Found columns: {list(rows[0])}"
        )
    return rows


def print_counts(label: str, values: list[str]) -> None:
    print(f"\n{label}:")
    for value, count in sorted(Counter(values).items()):
        print(f"  {value or '[blank]'}: {count}")


def main() -> None:
    print("Downloading public university complaint dataset (CC BY 4.0)...")
    split_rows = {split: download_split(split) for split in SPLITS}
    all_rows = [row for rows in split_rows.values() for row in rows]

    print("\nSOURCE: alaminxpro/university-students-complaints")
    print("LICENSE: CC BY 4.0 — attribution required")
    print(f"Raw files saved to: {DATA_DIR}")
    print(f"Train rows: {len(split_rows['train'])}")
    print(f"Test rows:  {len(split_rows['test'])}")
    print(f"Total rows: {len(all_rows)}")
    print(f"Columns: {list(all_rows[0])}")

    for column, label in (
        ("Category", "Original categories"),
        ("Severity", "Original severity labels"),
        ("Primary_Department", "Primary departments"),
    ):
        print_counts(label, [row.get(column, "").strip() for row in all_rows])

    descriptions = [row.get("Complaint_Description", "").strip().casefold() for row in all_rows]
    groups_by_split = {
        split: {row.get("Complaint_Group_ID", "").strip() for row in rows}
        for split, rows in split_rows.items()
    }
    group_overlap = groups_by_split["train"] & groups_by_split["test"]
    train_text = {
        row.get("Complaint_Description", "").strip().casefold()
        for row in split_rows["train"]
    }
    test_text = {
        row.get("Complaint_Description", "").strip().casefold()
        for row in split_rows["test"]
    }
    missing_text = sum(not text for text in descriptions)

    print("\nDATA QUALITY")
    print(f"Blank complaint descriptions: {missing_text}")
    print(f"Unique complaint descriptions: {len(set(descriptions) - {''})}")
    print(f"Duplicate description rows: {len(descriptions) - len(set(descriptions))}")
    print(f"Complaint groups shared across official train/test splits: {len(group_overlap)}")
    print(f"Exact descriptions shared across official train/test splits: {len(train_text & test_text)}")
    print("\nNo records have been mapped to GrievX labels or added to the model training set.")
    print("Review the original labels and group split audit before using this data for training.")


if __name__ == "__main__":
    main()
