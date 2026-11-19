"""
SmartShelf AI Inventory Analysis Engine.
Analyzes current household inventory, unopened stock, in-use units, and previous consumption
to deliver a clear snapshot, explainable Buy vs Avoid recommendations, and calculated savings.
"""

from typing import Dict, List, Any
from datetime import date

def get_product_icon_type(name: str, category: str) -> str:
    name_lower = name.lower()
    cat_lower = category.lower()
    if "medicine" in cat_lower or "supplement" in cat_lower or "tablet" in name_lower or "paracetamol" in name_lower or "vitamin" in name_lower:
        return "medicine"
    if "shampoo" in name_lower or "hair" in name_lower:
        return "shampoo"
    if "face wash" in name_lower or "cleanser" in name_lower:
        return "cleanser"
    if "moisturizer" in name_lower or "cream" in name_lower or "lotion" in name_lower:
        return "moisturizer"
    if "soap" in name_lower or "wash" in name_lower or "gel" in name_lower or "dish" in name_lower:
        return "soap"
    if "detergent" in name_lower or "clean" in name_lower:
        return "detergent"
    if "paste" in name_lower or "brush" in name_lower:
        return "toothbrush"
    return "package"

class InventoryRecommender:
    def __init__(self, consumption_model, waste_risk_model):
        self.consumption_model = consumption_model
        self.waste_risk_model = waste_risk_model

    def analyze_inventory(self, inventory: List[Dict[str, Any]], household_size: int = 1, consumption_logs: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Comprehensive AI Inventory Analysis:
        - Current Inventory Snapshot with exact emoji and stock counts
        - Unopened vs In-Use counts
        - What to Buy (Consider Buying)
        - What NOT to Buy (Avoid Buying Now)
        - Explainable 'Why?' rationale and financial savings based on actual past consumption
        """
        consider_buying = []
        avoid_buying = []
        attention_items = []
        snapshot = []
        total_avoided_spend = 0.0
        total_potential_waste_value = 0.0

        today = date.today()

        # Helper to find latest removal/finish log for a product
        def get_product_depletion_reason(item_dict: Dict[str, Any]) -> str:
            prod_id = item_dict.get("id")
            p_name = (item_dict.get("name") or "").strip().lower()
            exp_date_str = item_dict.get("expiry_date")

            # Check if past expiry
            if exp_date_str:
                try:
                    from datetime import datetime
                    exp_d = datetime.strptime(exp_date_str[:10], "%Y-%m-%d").date()
                    if exp_d < today:
                        days_ago = (today - exp_d).days
                        return f"Product expired {days_ago} days ago ({exp_d.isoformat()})."
                except Exception:
                    pass

            # Check logs
            if consumption_logs:
                for log in consumption_logs:
                    l_pid = log.get("product_id")
                    l_pname = (log.get("product_name") or "").strip().lower()
                    if (prod_id and l_pid and prod_id == l_pid) or (p_name and p_name in l_pname) or (l_pname and l_pname in p_name):
                        status = log.get("status")
                        wasted_reason = log.get("wasted_reason")
                        if status == "consumed":
                            return "Previous unit was completely finished by your household."
                        elif status == "wasted":
                            reason_txt = wasted_reason or "expired or unusable"
                            return f"Previous unit was discarded/wasted ({reason_txt})."

            item_status = item_dict.get("status")
            if item_status == "finished":
                return "Previous unit was completely finished."
            if item_status in ("discarded", "wasted"):
                return "Previous unit was discarded from inventory."

            return "Previous unit finished or removed from inventory."

        for item in inventory:
            name = item.get("name", "Product")
            category = item.get("category", "Personal Care")
            qty = item.get("quantity", 0)
            unopened = item.get("unopened_quantity", 0)
            in_use = item.get("in_use_quantity", 0)
            price = float(item.get("price", 0.0))
            expiry = item.get("expiry_date")
            opened_date = item.get("opened_date")
            icon_type = get_product_icon_type(name, category)

            risk_eval = self.waste_risk_model.predict_risk(
                product_name=name,
                category=category,
                unopened_quantity=unopened,
                in_use_quantity=in_use,
                opened_date=opened_date,
                expiry_date=expiry,
                household_size=household_size
            )

            runway = risk_eval["total_supply_runway_days"]
            exp_days = risk_eval["expected_duration_per_unit_days"]
            risk_level = risk_eval["risk_level"]

            # Snapshot Item Entry
            snapshot.append({
                "name": name,
                "category": category,
                "icon_type": icon_type,
                "total_quantity": qty,
                "unopened_quantity": unopened,
                "in_use_quantity": in_use,
                "supply_runway_days": runway,
                "risk_level": risk_level,
                "line_display": f"{name} — {qty}"
            })

            if risk_level == "high":
                attention_items.append({
                    "name": name,
                    "reason": risk_eval["explanation"],
                    "risk_level": "high",
                    "price": price,
                    "days_to_expiry": risk_eval["days_to_expiry"],
                    "runway_days": runway
                })
                total_potential_waste_value += price

            # Decision Logic: Buy vs Avoid
            if qty == 0 or (in_use == 0 and unopened == 0):
                # Out of stock entirely
                depletion_reason = get_product_depletion_reason(item)
                why_bullets = [
                    "Inventory stock is zero (0 units left of this product).",
                    f"Status reason: {depletion_reason}",
                    f"On average, your household finishes 1 unit every ~{exp_days} days.",
                    "Restocking now prevents running out during everyday routine."
                ]

                consider_buying.append({
                    "name": name,
                    "category": category,
                    "icon_type": icon_type,
                    "urgency": "high",
                    "reason": "Inventory stock is zero (0 units remaining).",
                    "stock_left_label": "0 left in stock",
                    "why_bullets": why_bullets
                })
            elif in_use > 0 and unopened == 0 and risk_eval["remaining_in_use_days"] <= 7:
                # Running critically low with 0 backups
                rem_days = risk_eval["remaining_in_use_days"]
                days_used = risk_eval["days_in_use"]
                why_bullets = [
                    f"Current unit was opened {days_used} days ago (1 unit in active use, 0 unopened backups).",
                    f"On average, your household finishes 1 unit in ~{exp_days} days.",
                    f"Inventory stock remaining: ~{rem_days} days of supply left of this product.",
                    "No backup units in storage."
                ]

                consider_buying.append({
                    "name": name,
                    "category": category,
                    "icon_type": icon_type,
                    "urgency": "medium",
                    "reason": f"Running low: only ~{rem_days} days of supply left.",
                    "stock_left_label": f"~{rem_days}d left of this product",
                    "why_bullets": why_bullets
                })
            else:
                # User has sufficient stock or unopened units
                why_bullets = []
                total_units = unopened + in_use
                why_bullets.append(f"Inventory stock remaining: {total_units} unit{'s' if total_units > 1 else ''} left of this product ({unopened} unopened backup{'s' if unopened != 1 else ''}, {in_use} in use).")
                why_bullets.append(f"On average, your household finishes 1 unit in ~{exp_days} days.")
                why_bullets.append(f"Your current inventory is estimated to last approximately {runway} days.")
                if risk_level == "high":
                    why_bullets.append("Alert: Purchasing another unit now would exacerbate expiry waste risk.")

                avoid_buying.append({
                    "name": name,
                    "category": category,
                    "icon_type": icon_type,
                    "unopened_count": unopened,
                    "in_use_count": in_use,
                    "supply_runway_days": runway,
                    "price": price,
                    "reason": f"Current stock is sufficient ({total_units} units left, lasts ~{runway} days).",
                    "stock_left_label": f"{total_units} units left (~{runway}d)",
                    "why_bullets": why_bullets
                })
                total_avoided_spend += price

        return {
            "inventory_snapshot": snapshot,
            "consider_buying": consider_buying,
            "avoid_buying": avoid_buying,
            "attention_items": attention_items,
            "total_avoided_spend": round(total_avoided_spend, 2),
            "potential_waste_value": round(total_potential_waste_value, 2),
            "summary": {
                "total_products": len(inventory),
                "in_use_count": sum(p.get("in_use_quantity", 0) for p in inventory),
                "unopened_count": sum(p.get("unopened_quantity", 0) for p in inventory),
                "consider_buying_count": len(consider_buying),
                "avoid_buying_count": len(avoid_buying),
                "high_waste_risk_count": len(attention_items)
            }
        }
