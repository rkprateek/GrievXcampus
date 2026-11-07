# External university complaint dataset — source note

GrievX is evaluating the public dataset **alaminxpro/university-students-complaints** hosted on Hugging Face.

- Dataset page: https://huggingface.co/datasets/alaminxpro/university-students-complaints
- License shown by the publisher: **CC BY 4.0**. Retain attribution and check the dataset card's terms before redistribution.
- Published viewer: 332 rows, with 273 in the train split and 59 in the test split.
- Relevant fields include `Complaint_Description`, `Category`, `Primary_Department`, `Severity`, and `Complaint_Group_ID`.
- The source contains academic, administrative, finance, infrastructure and technical complaints. It is not a direct one-to-one match for GrievX's nine campus-maintenance categories.
- The dataset includes paraphrase/group identifiers. Group-aware splitting is required to avoid putting related paraphrases in both training and evaluation data.
- Student demographics and other personal/context fields are not needed for GrievX model training and should not be imported.

## Audit before integration

From the repository root, run:

```powershell
python -m ml.scripts.inspect_university_dataset
```

The script downloads the official `train.csv` and `test.csv` into
`ml/data/external/university_students_complaints/`, reports label distributions,
missing descriptions, duplicates and group overlap, and does **not** merge the
source records into the GrievX seed dataset.

Do not train on the source's official test split. After label mapping is reviewed,
use only eligible training records and create a new group-aware validation split.
Keep the official test split untouched for a final external evaluation.

## Attribution

Dataset: *University Students Complaints*, by alaminxpro, Hugging Face Datasets,
https://huggingface.co/datasets/alaminxpro/university-students-complaints
License: CC BY 4.0.


## Conservative mapping preparation

After downloading and inspecting the source data, run:

```powershell
python -m ml.scripts.prepare_university_dataset
```

The script writes separate files under `mapped/`:

- `train_mapped.csv`
- `test_mapped.csv`

It preserves every source column and adds `source_split`,
`grievx_candidate_category`, `mapping_reason`, `mapping_status`, and
`grievx_priority_candidate`.

Mapping is based on complaint-description keyword rules. Clear single-category
matches are marked `candidate`; descriptions matching multiple GrievX
categories are marked `review`; descriptions without a clear match are marked
`excluded`. The source `Aspects` field is deliberately not used because the
audit found it can conflict with complaint meaning.

The script does not assign a GrievX priority, does not alter source labels, does
not merge train and test, and does not modify `ml/data/complaints_seed.csv`.
Candidate labels are proposals for review, not verified ground truth. Review
the generated CSVs and counts before any training integration.


## Human-reviewed mapping decisions

The approved group-level decisions are stored in
`ml/data/external/university_students_complaints/manual_mapping_decisions.csv`.
The preparation script applies these decisions by `Complaint_Group_ID` to
both source splits, so paraphrases in a group receive the same decision.
`candidate` entries are approved category mappings; `review` entries remain
human-review cases and must not be used as confirmed training labels;
`excluded` entries remain outside the current GrievX scope.

The six earlier complaint-level decisions have now been matched to verified
group IDs and are applied by the preparation script. The resolved decisions
are documented in `pending_group_id_decisions.md`. Keep manual-review records
out of confirmed training labels. After running the preparation script, inspect
the reports and verify group coverage before considering any model training.
No source CSV or seed dataset is overwritten by this workflow.
