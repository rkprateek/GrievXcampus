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
