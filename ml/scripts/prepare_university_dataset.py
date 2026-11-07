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


# Human decisions are keyed by Complaint_Group_ID so every paraphrase in a
# group receives the same decision in both official source splits.
# "candidate" means approved category mapping; "review" is never a training
# label; "excluded" is deliberately outside the current GrievX scope.
MANUAL_GROUP_DECISIONS: dict[str, tuple[str, str, str]] = {
    # Earlier review of excluded groups
    "8": ("", "review", "library_behaviour_requires_scope_review"),
    "11": ("", "excluded", "lift_queue_not_a_confirmed_lift_fault"),
    "26": ("Classroom & Facilities", "review", "library_and_study_space_capacity_needs_human_confirmation"),
    "34": ("Classroom & Facilities", "candidate", "approved_manual_facilities_mapping"),
    "36": ("Classroom & Facilities", "candidate", "approved_manual_facilities_mapping"),
    "48": ("IT & Network|Classroom & Facilities", "review", "lab_equipment_type_requires_human_review"),
    "50": ("IT & Network", "candidate", "approved_classroom_av_equipment_mapping"),
    "61": ("Electrical", "candidate", "approved_exhaust_fan_mapping"),
    "64": ("Security", "review", "student_safety_requires_human_review"),
    "79": ("Classroom & Facilities", "candidate", "approved_washroom_facilities_mapping"),
    "82": ("Electrical", "candidate", "approved_air_conditioning_mapping"),
    "83": ("Cleanliness", "candidate", "approved_cleanliness_mapping"),
    "98": ("IT & Network|Classroom & Facilities", "review", "lab_maintenance_type_requires_human_review"),

    # Remaining excluded-group review
    "3": ("Classroom & Facilities", "candidate", "approved_prayer_room_facilities_mapping"),
    "20": ("", "review", "research_facilities_request_mixes_academic_and_physical_resources"),
    "39": ("", "review", "student_coercion_requires_human_review"),
    "56": ("", "excluded", "cafeteria_service_preference_outside_current_scope"),
    "72": ("Classroom & Facilities", "candidate", "approved_prayer_room_facilities_mapping"),
    "80": ("Classroom & Facilities", "candidate", "approved_washroom_facilities_mapping"),
    "84": ("Security", "review", "student_safety_requires_human_review"),
    "87": ("Classroom & Facilities", "candidate", "approved_prayer_room_facilities_mapping"),
    "94": ("Classroom & Facilities", "candidate", "approved_whiteboard_facilities_mapping"),
    "105": ("Classroom & Facilities", "candidate", "approved_prayer_room_facilities_mapping"),
    "113": ("Classroom & Facilities", "candidate", "approved_washroom_facilities_mapping"),
    "122": ("Electrical", "candidate", "approved_generator_power_backup_mapping"),
    "132": ("Electrical", "candidate", "approved_fan_mapping"),
    "136": ("Electrical", "candidate", "approved_generator_power_backup_mapping"),
    "139": ("Electrical", "candidate", "approved_air_conditioning_mapping"),
    "143": ("Electrical", "candidate", "approved_damaged_extension_cable_mapping"),
    "160": ("IT & Network", "review", "digital_receipt_issue_requires_confirmation_of_technical_cause"),
    "181": ("Transport", "review", "parking_attendant_availability_is_an_operational_staffing_issue"),
    "182": ("Transport", "candidate", "approved_parking_signage_mapping"),
    "184": ("Transport", "candidate", "approved_parking_management_mapping"),
    "189": ("Transport", "candidate", "approved_parking_congestion_mapping"),
    "190": ("Transport", "candidate", "approved_parking_safety_mapping"),
    "191": ("Transport", "candidate", "approved_parking_congestion_mapping"),
    "202": ("Electrical", "candidate", "approved_hand_dryer_equipment_mapping"),
    "213": ("Classroom & Facilities", "candidate", "approved_stair_railing_facilities_mapping"),
    "218": ("Plumbing", "candidate", "approved_leaking_tap_mapping"),

    # Out-of-scope academic, finance, and administrative complaint groups
    "9": ("", "excluded", "academic_advising_issue_outside_current_scope"),
    "19": ("", "excluded", "teaching_quality_issue_outside_current_scope"),
    "33": ("", "excluded", "financial_certificate_fee_issue_outside_current_scope"),
    "37": ("", "excluded", "payment_service_request_outside_current_scope"),
    "43": ("", "excluded", "academic_timetable_policy_outside_current_scope"),
    "58": ("", "excluded", "event_scheduling_outside_current_scope"),
    "59": ("", "excluded", "teaching_delivery_issue_outside_current_scope"),
    "63": ("", "excluded", "academic_group_allocation_outside_current_scope"),
    "66": ("", "excluded", "event_fee_policy_outside_current_scope"),
    "67": ("", "excluded", "academic_group_allocation_outside_current_scope"),
    "68": ("", "excluded", "assessment_policy_outside_current_scope"),
    "69": ("", "excluded", "academic_resource_fairness_outside_current_scope"),
    "77": ("", "excluded", "teaching_quality_issue_outside_current_scope"),
    "85": ("", "excluded", "thesis_supervision_process_outside_current_scope"),
    "91": ("", "excluded", "academic_advising_issue_outside_current_scope"),
    "97": ("", "excluded", "academic_timetable_policy_outside_current_scope"),
    "107": ("", "excluded", "academic_advising_issue_outside_current_scope"),
    "111": ("", "excluded", "teaching_quality_issue_outside_current_scope"),
    "115": ("", "excluded", "payment_service_request_outside_current_scope"),
    "146": ("", "excluded", "fee_payment_administration_outside_current_scope"),
    "147": ("", "excluded", "fee_payment_queue_outside_current_scope"),
    "148": ("", "excluded", "late_fee_dispute_outside_current_scope"),
    "149": ("", "excluded", "fee_refund_process_outside_current_scope"),
    "150": ("", "excluded", "fee_receipt_administration_outside_current_scope"),
    "151": ("", "excluded", "scholarship_fee_adjustment_outside_current_scope"),
    "153": ("", "excluded", "fee_statement_clarity_outside_current_scope"),
    "156": ("", "excluded", "fee_clearance_process_outside_current_scope"),
    "161": ("", "excluded", "late_fee_dispute_outside_current_scope"),
    "163": ("", "excluded", "payment_verification_process_outside_current_scope"),
    "165": ("", "excluded", "fee_refund_policy_outside_current_scope"),
    "167": ("", "excluded", "installment_payment_process_outside_current_scope"),
}

# Four additional earlier decisions were accepted as review notes, but their
# Complaint_Group_ID values were not captured. They are intentionally NOT
# applied by text matching; identify the IDs before turning them into rules.
PENDING_GROUP_ID_DECISIONS = (
    ("Bus tracking/routing app", "Transport"),
    ("Voltage fluctuation affecting computer lab equipment", "Electrical"),
    ("Outdoor campus lights not working", "Electrical"),
    ("Computer lab losing electricity", "Electrical"),
    ("Parking area drainage problem", "Plumbing"),
    ("Water leaking from classroom corridor ceiling", "Plumbing"),
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



def map_row(row: dict[str, str]) -> tuple[str, str, str]:
    group_id = (row.get("Complaint_Group_ID") or "").strip()
    if group_id in MANUAL_GROUP_DECISIONS:
        category, status, reason = MANUAL_GROUP_DECISIONS[group_id]
        return category, reason, status
    return map_description(row.get("Complaint_Description", ""))


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
            candidate, reason, status = map_row(source)
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
    print("- Approved group-level human decisions override keyword rules consistently across both splits.")
    print("- Manual-review records are not confirmed training labels.")
    print("- Six earlier description-based decisions still need group IDs and are not applied.")
    print("- Security terms take precedence over parking context; charging points map to Electrical.")
    print("- Source Severity is preserved; GrievX priority candidates remain blank.")
    print("- Train and official test outputs remain separate.")
    print("- Nothing is added to ml/data/complaints_seed.csv or model training.")
    print(f"- Applied {len(MANUAL_GROUP_DECISIONS)} approved group-level decisions when their group IDs are present.")


if __name__ == "__main__":
    main()
