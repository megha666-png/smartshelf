"""
SmartShelf Waste Risk Prediction Model.
Predicts the probability of household products expiring or going to waste before full consumption.
"""

from datetime import date, datetime
from typing import Dict, Optional

class WasteRiskModel:
    def __init__(self, consumption_model):
        self.consumption_model = consumption_model

    def predict_risk(
        self,
        product_name: str,
        category: str,
        unopened_quantity: int,
        in_use_quantity: int,
        opened_date: Optional[str] = None,
        expiry_date: Optional[str] = None,
        household_size: int = 1,
        reference_date: Optional[date] = None
    ) -> Dict:
        """
        Calculates waste risk level, waste probability, and supply runway.
        """
        today = reference_date or date.today()
        consumption_info = self.consumption_model.predict_consumption(
            product_name=product_name,
            category=category,
            household_size=household_size
        )
        expected_duration = consumption_info["predicted_duration_days"]

        # Calculate remaining days for currently opened unit
        days_in_use = 0
        if in_use_quantity > 0 and opened_date:
            try:
                op_date = datetime.strptime(opened_date[:10], "%Y-%m-%d").date()
                days_in_use = max(0, (today - op_date).days)
            except Exception:
                days_in_use = 0

        remaining_in_use_days = max(0, expected_duration - days_in_use) if in_use_quantity > 0 else 0
        total_supply_runway = remaining_in_use_days + (unopened_quantity * expected_duration)

        # Parse expiry date
        days_to_expiry = None
        if expiry_date:
            try:
                exp_date = datetime.strptime(expiry_date[:10], "%Y-%m-%d").date()
                days_to_expiry = (exp_date - today).days
            except Exception:
                days_to_expiry = None

        # Risk scoring
        if days_to_expiry is not None:
            if days_to_expiry <= 0:
                risk_level = "high"
                risk_percentage = 98
                explanation = f"Product passed expiry date ({abs(days_to_expiry)} days ago)."
            elif unopened_quantity > 0 and days_to_expiry < expected_duration:
                risk_level = "high"
                risk_percentage = 88
                explanation = (
                    f"Expiry is in {days_to_expiry} days, but typical consumption is {expected_duration} days. "
                    f"Unopened stock will likely expire before you can finish it."
                )
            elif days_to_expiry < total_supply_runway:
                risk_level = "high"
                ratio = total_supply_runway / max(1, days_to_expiry)
                risk_percentage = min(95, int(70 + (ratio - 1.0) * 25))
                explanation = (
                    f"Current stock will last ~{total_supply_runway} days, but product expires in {days_to_expiry} days. "
                    f"High probability of partial waste."
                )
            elif days_to_expiry < (total_supply_runway * 1.3):
                risk_level = "medium"
                risk_percentage = 55
                explanation = (
                    f"Moderate buffer: Supply lasts ~{total_supply_runway} days vs {days_to_expiry} days until expiry."
                )
            else:
                risk_level = "low"
                risk_percentage = 15
                explanation = f"Safe margin: Supply runway ~{total_supply_runway} days is well within {days_to_expiry} days expiry."
        else:
            # Expiry unknown: risk based only on over-accumulation
            if unopened_quantity >= 3:
                risk_level = "medium"
                risk_percentage = 45
                explanation = f"No expiry date recorded, but {unopened_quantity} unopened units accumulated."
            else:
                risk_level = "low"
                risk_percentage = 10
                explanation = "Standard consumption pace with no near-term expiry conflict."

        return {
            "product_name": product_name,
            "category": category,
            "risk_level": risk_level,
            "risk_percentage": risk_percentage,
            "expected_duration_per_unit_days": expected_duration,
            "days_in_use": days_in_use,
            "remaining_in_use_days": remaining_in_use_days,
            "total_supply_runway_days": total_supply_runway,
            "days_to_expiry": days_to_expiry,
            "explanation": explanation
        }
