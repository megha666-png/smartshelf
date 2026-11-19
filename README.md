# SmartShelf — Quiet Intelligence for Everyday Living

> **Less waste. Smarter choices. A healthier home.**

SmartShelf is an AI-powered household inventory and consumption management system designed to reduce consumer product waste and eliminate unnecessary spending through ambient, non-intrusive machine learning.

---

## Visual Identity & UI Alignment

Designed following the exact SmartShelf Design System:
- **Palette**: Deep Ink (`#26312C`), Primary Sage (`#6F8874`), Soft Sage (`#DDE7DE`), Warm Ivory (`#F7F6F1`), Soft Sand (`#E8E1D5`), Muted Gold (`#C89B52`), Soft Coral (`#C86B63`).
- **Typography**: `Manrope` (Headings & Display), `Inter` (Body & Inputs).
- **Themes**: Seamless Light Mode & Dark Mode toggle.
- **Icons**: Minimalist line icons with the signature 4-point star AI indicator (✦).

---

## Team Division & Architecture

| Role | Domain | Key Files | Deliverables |
| :--- | :--- | :--- | :--- |
| **Person 1** | **Frontend + UI/UX** | `frontend/index.html`, `frontend/css/`, `frontend/js/` | Responsive client, Home Balance ring, filterable inventory, Before-You-Buy scorer, Ingredient scanner, Analytics. |
| **Person 2** | **Backend + Database** | `backend/main.py`, `backend/database.py`, `backend/schemas.py` | FastAPI RESTful service, SQLite relational storage, Household code sync (`SHLF-XXXX`), lifecycle triggers. |
| **Person 3** | **ML + AI + Analytics** | `ml/consumption_model.py`, `ml/waste_risk_model.py`, `ml/inventory_recommender.py`, `ml/ingredient_analyzer.py` | Consumption velocity estimator, Waste risk classifier, Explainable Buy/Avoid recommender, Ingredient toxicology engine. |

---

## Core Machine Learning & AI Modules

### 1. Consumption Prediction (`ml/consumption_model.py`)
- Learns the user's consumption velocity per product (e.g. Dove Shampoo = ~40 days/bottle).
- Uses empirical Bayesian shrinkage between personal usage history and category prior baselines.
- Scales duration dynamically with household size ($T_{hh} = T_{base} / \sqrt{N}$).

### 2. Waste-Risk Prediction (`ml/waste_risk_model.py`)
- Calculates remaining supply runway:
  $$\text{Runway} = \text{Remaining In-Use Days} + (\text{Unopened Units} \times \text{Expected Duration})$$
- Evaluates runway against expiry date ($\Delta_{expiry}$):
  - **Low Risk**: Runway comfortably finished before expiry.
  - **Medium Risk**: Tight margin ($0.8 \le \text{Ratio} \le 1.2$).
  - **High Risk**: Product will expire before full consumption.

### 3. AI Inventory Analysis with "Why?" Explanations (`ml/inventory_recommender.py`)
- Analyzes saved household inventory to categorize items into **Consider Buying** vs. **Avoid Buying Now**.
- Supplies human-understandable "WHY?" rationale for every recommendation.
- Calculates money saved by postponing unnecessary purchases.

### 4. Product Ingredient Safety Scanner (`ml/ingredient_analyzer.py`)
- Parses cosmetic and household product formulation labels.
- Evaluates against a verified database of cosmetic chemicals.
- Flags irritants and sensitizers (**Fragrance / Parfum, Parabens, Sodium Lauryl Sulfate, Formaldehyde releasers, BHT, Phthalates**) with balanced scientific explanations.
- Calculates an objective formulation match percentage (e.g., `76% Match`).

### 5. Camera Product Recognition & Auto-Categorization (`ml/product_categorizer.py`)
- Point camera at any household product packaging or upload a snapshot.
- Automatically classifies products into canonical shelves:
  - **Personal Care** (Shampoo, Cleanser, Oral Hygiene, Soaps, Skincare)
  - **Medicines & Supplements** (Tablets, Syrups, Pain Relief, Vitamins, First Aid)
  - **Cleaning** (Detergents, Dishwashing, Surface cleaners, Bleach)
  - **Household** (Batteries, Tissues, Foil, Wraps, Repellents)
- Predicts expected consumption runway days, typical price, and match confidence (e.g., `94% Match`).
- One-click auto-save directly into the categorized household inventory.

---

## Getting Started

### 1. Start the Application
From the `smartshelf` project directory, run:
```bash
./run.sh
```
Or directly with the standalone zero-dependency server:
```bash
python3 backend/standalone_server.py 8000
```

### 2. Open SmartShelf
Open your browser and navigate to:
```
http://localhost:8000
```

---

## Pre-Seeded Demonstration Household
The app automatically initializes with **"The Sharma Home"** (Household Code: `SHLF-4829`):
- **Members**: Alex Sharma (Admin), Priya Sharma, Rohan Sharma.
- **Inventory Items**:
  - Dove Moisture Shampoo (2 unopened, 1 in use, low waste risk)
  - Himalaya Neem Face Wash (1 in use, 0 unopened)
  - Colgate Total Toothpaste (0 units — recommended to buy!)
  - Cetaphil Moisturizer (1 unopened, 28 days to expiry vs. 50-day consumption — **High Waste Risk Alert!**)
  - Ariel Matic Detergent (1 in use, ~3 days left — restock soon)
  - Organic Granola & Vim Dishwashing Gel
- **Real-time Home Balance**: `82 / 100` ("Well balanced").

