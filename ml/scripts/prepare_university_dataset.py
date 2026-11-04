"""Prepare a conservative, auditable mapping of the external university dataset.

Run from the repository root:
    python -m ml.scripts.prepare_university_dataset

The script never edits the source CSVs or the existing GrievX seed dataset.
It preserves the official train/test split and all source columns. It does not
map priority labels because source severity is not equivalent to GrievX priority.
"""
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

DATA_DIR = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "external"
    / "university_students_complaints"
)
OUTPUT_DIR = DATA_DIR / "mapped"
SOURCE_SPLITS = ("train", "test")

# Rules are deliberately based on complaint text, not the source Aspects field.
# More specific safety/transport/hostel rules run before broad facilities rules.
RULES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    (
        "Security",
        (
            "harass", "threat", "intruder", "unauthorized entry", "unauthorised entry",
            "theft", "stolen", "assault", "unsafe person", "security guard",
            "cctv", "gate lock", "security gate", "security monitoring", "weak security", "violence",
        ),
        "security_or_personal_safety_terms",
    ),
    (
        "Transport",
        (
            "campus bus", "bus ", "bus.", "shuttle", "transport",
            "parking space", "parking area", "parking spot", "parking spots",
            "parking markings", "bicycle parking", "motorcycle parking",
            "vehicle", "traffic", "bus route", "bus tracking",
        ),
        "transport_or_parking_terms",
    ),
    (
        "Hostel",
        (
            "hostel", "dormitory", "dorm room", "hostel room",
        ),
        "explicit_hostel_context",
    ),
    (
        "IT & Network",
        (
            "wi-fi", "wifi", "internet", "network", "server", "portal",
            "computer", "laptop", "projector", "hdmi", "printer", "software",
            "login", "website", "application", "app system", "router",
        ),
        "it_or_digital_equipment_terms",
    ),
    (
        "Electrical",
        (
            "electrical", "electricity", "electric ", "wiring", "wire ",
            "switchboard", "socket", "power outage", "power interruption",
            "power supply", "voltage", "transformer", "sparks", "burning smell",
            "smoke from", "light ", "lights ", "tube light", "bulb", "flicker",
            "air conditioner", " ac ", " ac's", "fan not", "fan is",
            "charging port", "charging point",
        ),
        "electrical_or_power_terms",
    ),
    (
        "Plumbing",
        (
            "water leak", "water leakage", "leaking tap", "tap is leaking",
            "tap ", "water supply", "drinking water", "water system",
            "water pipe", "pipeline", "plumbing", "drain", "drainage",
            "sewage", "toilet flush", "flush not", "water pressure",
            "water pooling", "water accumulates", "burst pipe",
        ),
        "water_or_drainage_terms",
    ),
    (
        "Cleanliness",
        (
            "garbage", "waste collection", "litter", "dirty", "cleaning",
            "unhygienic", "sanitation", "dustbin", "dust bins",
            "toilet paper", "hand wash", "unpleasant smell", "pest problem",
        ),
        "cleanliness_or_sanitation_terms",
    ),
    (
        "Classroom & Facilities",
        (
            "wall", "plaster",
            "ceiling", "chair", "desk", "furniture", "door ", "window",
            "elevator", "lift ", "staircase",
            "library space", "study room", "wheelchair",
            "lab equipment", "laboratory equipment",
        ),
        "physical_facility_terms",
    ),
)

def read_rows(split: str) -> tuple[list[str], list[dict[str, str]]]:
    path = DATA_DIR / f"{split}.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run python -m ml.scripts.inspect_university_dataset first."
        )
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"{path} has no CSV header.")
        rows = list(reader)
        return list(reader.fieldnames), rows


def map_description(description: str) -> tuple[str, str, str]:
    text = " ".join((description or "").casefold().split())
    if not text:
        return "", "blank_description", "excluded"

    # Specific safety/security issues should not become transport issues
    # merely because the complaint mentions a parking area.
    security_terms = RULES[0][1]
    if any(term in text for term in security_terms):
        return "Security", "security_or_personal_safety_terms", "candidate"

    matches: list[tuple[str, str]] = []
    for label, terms, reason in RULES:
        if any(term in text for term in terms):
            matches.append((label, reason))

    distinct_labels = {label for label, _ in matches}
    if len(distinct_labels) == 1:
        label = matches[0][0]
        reasons = "+".join(dict.fromkeys(reason for _, reason in matches))
        return label, reasons, "candidate"

    if len(distinct_labels) > 1:
        labels = "|".join(label for label, _ in matches)
        reasons = "+".join(dict.fromkeys(reason for _, reason in matches))
        return labels, reasons, "review"

    return "", "no_clear_grievx_category_match", "excluded"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    totals: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()

    for split in SOURCE_SPLITS:
        fieldnames, source_rows = read_rows(split)
        extra_fields = [
            "source_split",
            "grievx_candidate_category",
            "mapping_reason",
            "mapping_status",
            "grievx_priority_candidate",
        ]
        output_fields = fieldnames + [name for name in extra_fields if name not in fieldnames]
        output_rows: list[dict[str, str]] = []

        for source in source_rows:
            candidate, reason, status = map_description(
                source.get("Complaint_Description", "")
            )
            row = dict(source)
            row["source_split"] = split
            row["grievx_candidate_category"] = candidate
            row["mapping_reason"] = reason
            row["mapping_status"] = status
            # Intentionally blank: source Severity is retained unchanged.
            row["grievx_priority_candidate"] = ""
            output_rows.append(row)
            totals[f"{split}:{status}"] += 1
            if status == "candidate":
                category_counts[candidate] += 1

        output_path = OUTPUT_DIR / f"{split}_mapped.csv"
        with output_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=output_fields)
            writer.writeheader()
            writer.writerows(output_rows)
        print(f"Wrote {len(output_rows)} rows: {output_path}")

    print("\nMAPPING SUMMARY")
    for key in sorted(totals):
        print(f"{key}: {totals[key]}")
    print("\nUNAMBIGUOUS CANDIDATE CATEGORY COUNTS (both splits):")
    for label, count in sorted(category_counts.items()):
        print(f"{label}: {count}")

    print("\nIMPORTANT")
    print("- Source columns and source labels are preserved.")
    print("- Only clear, single-category text matches are marked candidate.")
    print("- Multi-category matches are marked review; unmatched rows are excluded.")
    print("- The Aspects field is not used because the audit showed it is noisy.")
    print("- Projectors, HDMI and Wi-Fi remain IT even when classrooms are mentioned.")
    print("- Security terms take precedence over parking context; charging points map to Electrical.")
    print("- Source Severity is preserved; GrievX priority candidates remain blank.")
    print("- Train and official test outputs remain separate.")
    print("- Nothing is added to ml/data/complaints_seed.csv or model training.")


if __name__ == "__main__":
    main()
