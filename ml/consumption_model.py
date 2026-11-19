"""
SmartShelf Consumption Rate and Duration Prediction Model.
Learns product-specific consumption velocity and duration using empirical Bayes and regression.
"""

from typing import Dict, List, Optional
import numpy as np
try:
    from ml.datasets.household_sample_data import (
        SAMPLE_CONSUMPTION_HISTORY,
        CATEGORY_BASELINES_DAYS
    )
except ImportError:
    from smartshelf.ml.datasets.household_sample_data import (
        SAMPLE_CONSUMPTION_HISTORY,
        CATEGORY_BASELINES_DAYS
    )

class ConsumptionModel:
    def __init__(self, history: Optional[List[Dict]] = None):
        self.history = history or list(SAMPLE_CONSUMPTION_HISTORY)
        self.category_baselines = dict(CATEGORY_BASELINES_DAYS)

    def add_consumption_event(self, product_name: str, category: str, duration_days: int, status: str = "consumed", cost: float = 0.0):
        """Adds a completed consumption record to the user's history."""
        self.history.append({
            "product_name": product_name,
            "category": category,
            "duration_days": duration_days,
            "status": status,
            "cost": cost
        })

    def get_product_history(self, product_name: str) -> List[int]:
        """Returns list of duration days for completed consumption of a specific product."""
        durations = []
        name_lower = product_name.strip().lower()
        for item in self.history:
            if item.get("status") == "consumed" and name_lower in item.get("product_name", "").lower():
                durations.append(item["duration_days"])
        return durations

    def get_category_history(self, category: str) -> List[int]:
        """Returns list of duration days for a category."""
        return [
            item["duration_days"]
            for item in self.history
            if item.get("status") == "consumed" and item.get("category", "").lower() == category.lower()
        ]

    def predict_consumption(self, product_name: str, category: str, household_size: int = 1) -> Dict:
        """
        Predicts typical consumption duration in days and daily burn rate.
        Applies empirical Bayes shrinkage between specific product history and category prior.
        """
        prod_records = self.get_product_history(product_name)
        cat_records = self.get_category_history(category)

        # Baseline category prior
        if cat_records:
            cat_mean = float(np.mean(cat_records))
        else:
            cat_mean = float(self.category_baselines.get(category, 30))

        if len(prod_records) >= 3:
            # Weighted average with recency weighting
            weights = np.linspace(0.6, 1.0, len(prod_records))
            weights /= weights.sum()
            estimated_days = float(np.sum(np.array(prod_records) * weights))
            confidence = "high"
            basis = f"Learned from {len(prod_records)} previous purchases (~{int(round(estimated_days))} days avg)"
        elif len(prod_records) > 0:
            # Empirical Bayes shrinkage towards category prior
            k = 2.0  # prior weight
            n = float(len(prod_records))
            prod_mean = float(np.mean(prod_records))
            estimated_days = (n * prod_mean + k * cat_mean) / (n + k)
            confidence = "moderate"
            basis = f"Combined {len(prod_records)} personal records with {category} category average"
        else:
            estimated_days = cat_mean
            confidence = "initial_estimate"
            basis = f"Based on typical {category} consumption baseline"

        # Multi-person household adjustment: more members increase usage velocity
        if household_size > 1:
            scale_factor = 1.0 / np.sqrt(household_size)
            estimated_days = max(5.0, estimated_days * scale_factor)

        rounded_days = int(round(estimated_days))
        burn_rate_daily = 1.0 / max(1.0, estimated_days)

        return {
            "product_name": product_name,
            "category": category,
            "predicted_duration_days": rounded_days,
            "daily_burn_rate": round(burn_rate_daily, 4),
            "confidence": confidence,
            "sample_size": len(prod_records),
            "explanation": basis
        }
