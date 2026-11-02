# GrievX Campus ML — Weeks 7 and 8

The project ML scope is limited to:
1. Text classification
2. Priority prediction
3. Department routing

Weeks 7 and 8 implement the first two capabilities as reproducible baseline models.
Duplicate detection remains an application feature, not a fourth ML model.

## Dataset

`ml/data/complaints_seed.csv` is a curated project seed dataset for development and demonstration.
It contains 54 labeled campus complaint examples across the nine project categories and three priority labels.
It is not presented as a real institutional dataset.

## Week 7 — Text classification

Implementation:
- TF-IDF vectorization with unigram and bigram features.
- Logistic Regression with class balancing.
- Stratified 80/20 evaluation split with a fixed random seed.
- Model version `text-classifier-v1.0.0`.
- Confidence output and low-confidence flag.
- FastAPI endpoints:
  - `POST /ml/classify`
  - `POST /ml/predict`

Example response fields:
- category
- confidence
- low_confidence
- model_version

## Week 8 — Priority prediction

Implementation:
- TF-IDF + Logistic Regression baseline for `normal`, `high`, and `critical`.
- Model version `priority-predictor-v1.0.0`.
- Explainable safety-rule override for clear hazards such as electrical shock, flooding, active security threats, transport safety hazards and structural hazards.
- FastAPI endpoints:
  - `POST /ml/priority`
  - `POST /ml/predict`

Example response fields:
- priority
- confidence
- method
- explanation
- matched_rules
- model_version

## Evaluation

Run:

    python -m services.api.app.ml.train_models

This reports accuracy and macro-F1 for both baselines using the same fixed stratified 80/20 split.

## Model versioning

`ml/model_registry.json` records:
- model version;
- dataset version;
- algorithm;
- label set;
- confidence threshold where applicable;
- evaluation method.

The current implementation intentionally trains the baseline model in memory from the curated seed dataset.
Persisted model artifacts and production model deployment will be introduced when the project moves beyond the baseline workflow.

## Scope boundary

Weeks 7–8 do not automatically classify or prioritize a newly submitted complaint.
That end-to-end workflow integration belongs to the later ML integration stage in the roadmap.


## Week 9 — Department routing

Department routing is deterministic after text classification rather than a separate ML model.

### Routing logic
- The Week 7 classifier predicts a complaint category.
- The predicted category is mapped to a project department code.
- If category confidence is below `0.55`, the complaint is routed to `General` and `requires_manual_review=true`.
- Routing returns both category confidence and routing confidence for explainability.

### Mapping
- Electrical → ELEC
- Plumbing → PLMB
- IT & Network → IT
- Cleanliness → CLEAN
- Classroom & Facilities → FAC
- Hostel → HOSTEL
- Security → SEC
- Transport → TRANS
- General → GEN

### API
- `POST /ml/route`
- `POST /ml/predict` now includes `routing`

This keeps routing transparent and easy for an admin to override later.

## Week 10 — Workflow integration

The ML service is now consumed by the student complaint workflow when `EXPO_PUBLIC_ML_API_URL` points to the FastAPI service.

For each submitted complaint:
- `POST /ml/predict` returns category, priority and department routing.
- The mobile client persists the category, confidence, priority and department-routing fields through the existing Supabase `apply_complaint_ml_predictions` RPC.
- Low-confidence routing is written with `department_source=manual_review`; the department fallback remains the Week 9 General route.
- If the optional ML service is unavailable, the complaint is still retained and staff can review it manually.

Duplicate detection is separate from the ML service. Supabase uses the existing configurable `find_possible_duplicates` RPC with `pg_trgm` title/description similarity and a near-matching campus-location signal, using the configured recency window and threshold.

When a student confirms that a possible duplicate is actually the same issue, the mobile app adds a community upvote to the existing complaint instead of opening a second ticket.
