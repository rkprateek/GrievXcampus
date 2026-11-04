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
