# GrievX Campus ML

The current ML workflow uses complaint **title and description text only**. Uploaded evidence images are stored and displayed to staff but are not sent to the ML service or analysed.

## Capabilities

1. **Complaint category classification** — TF-IDF word and bigram features with Logistic Regression.
2. **Priority prediction** — TF-IDF + Logistic Regression, with explicit critical-safety phrase overrides.
3. **Department routing** — deterministic category-to-department mapping with a low-confidence manual-review fallback.
4. **Automatic staff assignment** — performed by the Supabase workflow after a confident department route, using configured staff department, skills, availability and active workload.
5. **Duplicate detection** — a separate PostgreSQL `pg_trgm` similarity feature. It is not a fourth ML model.

## Dataset and limitations

The checked-in `ml/data/complaints_seed.csv` contains **54 curated development/demo examples** across nine categories and three priority labels. It is not real institutional data. The current models are baseline models for the MCA project demonstration; their confidence scores are model probabilities, not guarantees, and their measured metrics are not proof of production accuracy.

For a dependable campus deployment, collect a larger, representative, institution-approved dataset, have labels reviewed by campus staff, evaluate on a held-out time-based test set, and monitor misclassifications. Do not claim that the current seed dataset is production-grade.

## Models

- Category model: `text-classifier-v1.1.0`
- Priority model: `priority-predictor-v1.1.0`
- Department router: `department-router-v1.1.0`
- Vectorization: lowercase TF-IDF, unigrams and bigrams, sublinear term frequency.
- Classifier: Logistic Regression with class balancing.
- Routing threshold: `0.55`. Below this threshold, the system uses General as a safe fallback and requires admin review.
- Priority safety rules: possible electrical hazards, flooding/sewage emergencies, security threats, transport brake/safety issues and structural hazards are raised to critical. Negated phrases such as "no electric shock" do not trigger that matching rule. A critical flag still requires human assessment.

The serving models train once from the complete seed dataset when first loaded. Evaluation trains a separate model on a stratified 80/20 split and does not modify the live inference model.

## Run the API locally

From the repository root, in PowerShell:

```powershell
cd services/api
python -m pip install -e ".[test]"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check that the models load:

```
http://127.0.0.1:8000/ml/health
```

The health response reports the model versions and number of training examples. API endpoints:

- `GET /ml/health`
- `GET /ml/metrics` (seed-dataset evaluation metrics)
- `POST /ml/classify`
- `POST /ml/priority`
- `POST /ml/route`
- `POST /ml/predict`

Example request:

```json
{
  "title": "Wi-Fi is not working in Block C",
  "description": "Several students cannot connect to the campus network."
}
```

## Connect the Expo mobile app

The mobile app reads this exact environment variable. For the admin dashboard, also set `NEXT_PUBLIC_GRIEVX_API_URL` to the same base URL in `apps/admin/.env.local` if you want the ML Insights page to check API health and evaluation metrics. The API enables CORS for the origins listed in `CORS_ORIGINS` (default local admin origin is `http://localhost:3000`).

The mobile app reads this exact environment variable:

```env
EXPO_PUBLIC_GRIEVX_API_URL=http://YOUR_COMPUTER_LAN_IP:8000
```

Use the correct address for your device:
- Physical Android/iPhone: your computer's LAN IPv4 address; both devices must be on the same Wi-Fi.
- Android emulator: `http://10.0.2.2:8000`.
- iOS simulator: `http://127.0.0.1:8000`.

Do not use `localhost` on a physical phone: it points to the phone itself. After changing the Expo environment file, restart Expo with its cache cleared:

```powershell
npx expo start --clear
```

The app saves a complaint before calling ML. If the API is unavailable or returns an invalid response, the complaint remains saved and the app tells the student that manual review is required. When predictions succeed, the app calls `apply_complaint_ml_predictions` and saves the complete prediction record in `complaint_ml_predictions`.

The API call sends only the title and description. Evidence images are uploaded separately after complaint creation.

## Evaluate and test

Install the API package from `services/api`, then run the training report from the repository root:

```powershell
cd services/api
python -m pip install -e ".[test]"
cd ../..
python -m ml.train_models
python -m pytest services/api/tests
```

Evaluation reports accuracy and macro-F1, plus train/test sample counts and model versions. Review per-class errors before changing thresholds or presenting metrics.

## Supabase workflow prerequisites

The database must have the Week 7/8 ML columns, `complaint_ml_predictions` table and the Week 11 `staff_directory` migration.

Automatic staff assignment requires real profiles with role `staff` or `department_head`, plus an admin-configured staff directory entry for the correct department, skills, availability and capacity. Do not create placeholder staff accounts or claim assignment is operational until these records exist.

If no eligible staff member exists, the complaint still retains its category, priority and department prediction but remains unassigned for admin action.

## Troubleshooting

- `/ml/health` unavailable: start the FastAPI service and verify port 8000.
- Expo cannot connect: check the LAN IP, Windows firewall, Wi-Fi network and the environment variable spelling.
- Complaint saved but ML unavailable: check the student app alert and FastAPI terminal logs.
- Predictions generated but not applied: inspect the Supabase RPC error shown by the app.
- Prediction history not saved: verify the student's RLS policies on `complaint_ml_predictions`.
- No staff assigned: configure real staff profiles and their routing profiles in the admin dashboard.
