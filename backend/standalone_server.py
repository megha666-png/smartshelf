"""
SmartShelf Standalone Server (Zero External Dependencies).
Runs using pure Python 3 standard library (http.server, sqlite3, json, urllib).
Serves the exact same REST API endpoints, PWA manifests, and static frontend as FastAPI.
"""

import os
import sys
import json
import sqlite3
import subprocess
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, date

# Ensure project root and parent in path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PARENT_DIR = os.path.abspath(os.path.join(PROJECT_ROOT, ".."))
for p in [PROJECT_ROOT, PARENT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.database import db
    from ml.consumption_model import ConsumptionModel
    from ml.waste_risk_model import WasteRiskModel
    from ml.inventory_recommender import InventoryRecommender
    from ml.ingredient_analyzer import IngredientAnalyzer
    from ml.product_categorizer import ProductCategorizer
    from ml.datasets.household_sample_data import get_monthly_history_data, SAMPLE_MONTHLY_HISTORY
except ImportError:
    from smartshelf.backend.database import db
    from smartshelf.ml.consumption_model import ConsumptionModel
    from smartshelf.ml.waste_risk_model import WasteRiskModel
    from smartshelf.ml.inventory_recommender import InventoryRecommender
    from smartshelf.ml.ingredient_analyzer import IngredientAnalyzer
    from smartshelf.ml.product_categorizer import ProductCategorizer
    from smartshelf.ml.datasets.household_sample_data import get_monthly_history_data, SAMPLE_MONTHLY_HISTORY

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

# Initialize ML
consumption_model = ConsumptionModel()
waste_risk_model = WasteRiskModel(consumption_model)
recommender = InventoryRecommender(consumption_model, waste_risk_model)
ingredient_analyzer = IngredientAnalyzer()
product_categorizer = ProductCategorizer()

# Sync consumption history from db
with db.get_connection() as conn:
    cur = conn.cursor()
    cur.execute("SELECT product_name, category, duration_days, status, cost FROM consumption_logs;")
    for r in cur.fetchall():
        consumption_model.add_consumption_event(
            product_name=r["product_name"],
            category=r["category"],
            duration_days=r["duration_days"],
            status=r["status"],
            cost=r["cost"] or 0.0
        )

class SmartShelfRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_HEAD(self):
        self.do_GET(is_head=True)

    def do_GET(self, is_head=False):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # Static Frontend & PWA routing
        if path in ("/", "/index.html"):
            return self.serve_file(os.path.join(FRONTEND_DIR, "index.html"), "text/html", is_head=is_head)
        elif path in ("/manifest.json", "/static/manifest.json"):
            return self.serve_file(os.path.join(FRONTEND_DIR, "manifest.json"), "application/manifest+json", is_head=is_head)
        elif path in ("/sw.js", "/static/sw.js"):
            return self.serve_file(os.path.join(FRONTEND_DIR, "sw.js"), "application/javascript", is_head=is_head)
        elif path.startswith("/static/"):
            rel = path[len("/static/"):]
            file_path = os.path.join(FRONTEND_DIR, rel)
            return self.serve_file(file_path, is_head=is_head)
        elif os.path.exists(os.path.join(FRONTEND_DIR, path.lstrip("/"))):
            return self.serve_file(os.path.join(FRONTEND_DIR, path.lstrip("/")), is_head=is_head)

        # API Endpoints
        if path == "/api/household":
            hh_id = int(query.get("household_id", [1])[0])
            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT id, name, share_code, created_by FROM households WHERE id = ?;", (hh_id,))
                hh = cur.fetchone()
                if not hh:
                    return self.send_json({"detail": "Household not found"}, 404)
                cur.execute("""
                    SELECT u.id, u.name, u.email, hm.role, hm.joined_at
                    FROM users u
                    JOIN household_members hm ON u.id = hm.user_id
                    WHERE hm.household_id = ?;
                """, (hh_id,))
                members = [dict(m) for m in cur.fetchall()]
                return self.send_json({
                    "id": hh["id"],
                    "name": hh["name"],
                    "share_code": hh["share_code"],
                    "member_count": len(members),
                    "members": members
                })

        elif path == "/api/products":
            hh_id = int(query.get("household_id", [1])[0])
            cat = query.get("category", ["All"])[0]
            with db.get_connection() as conn:
                cur = conn.cursor()
                sql = "SELECT * FROM products WHERE household_id = ?"
                params = [hh_id]
                if cat != "All":
                    sql += " AND LOWER(category) = LOWER(?)"
                    params.append(cat)
                sql += " ORDER BY id DESC;"
                cur.execute(sql, params)
                raw_products = [dict(p) for p in cur.fetchall()]

            enriched = []
            for p in raw_products:
                risk = waste_risk_model.predict_risk(
                    product_name=p["name"],
                    category=p["category"],
                    unopened_quantity=p["unopened_quantity"],
                    in_use_quantity=p["in_use_quantity"],
                    opened_date=p.get("opened_date"),
                    expiry_date=p.get("expiry_date"),
                    household_size=3
                )
                p["ml_risk_level"] = risk["risk_level"]
                p["ml_risk_percentage"] = risk["risk_percentage"]
                p["ml_supply_runway_days"] = risk["total_supply_runway_days"]
                p["ml_expected_duration_days"] = risk["expected_duration_per_unit_days"]
                p["ml_risk_explanation"] = risk["explanation"]
                enriched.append(p)

            return self.send_json(enriched)

        elif path == "/api/analysis/overview":
            hh_id = int(query.get("household_id", [1])[0])
            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM products WHERE household_id = ?;", (hh_id,))
                inventory = [dict(p) for p in cur.fetchall()]
                cur.execute("SELECT * FROM consumption_logs WHERE household_id = ? ORDER BY id DESC;", (hh_id,))
                c_logs = [dict(l) for l in cur.fetchall()]
            analysis = recommender.analyze_inventory(inventory, household_size=3, consumption_logs=c_logs)
            return self.send_json(analysis)

        elif path == "/api/analysis/insights":
            return self.send_json({
                "main_pattern": {
                    "title": "Over-Purchasing Tendency",
                    "tag": "OVER-PURCHASING",
                    "description": "You tend to purchase backup personal care and health products before finishing existing stock.",
                    "suggestion": "Wait until your in-use item has 7 days or less remaining before ordering refills."
                },
                "this_month": {
                    "purchases_avoided": 3,
                    "rupees_saved": 1247.0,
                    "items_consumed": 7,
                    "total_spent": 4200.0,
                    "potential_waste_avoided": 650.0
                },
                "duplicate_buying": {
                    "title": "Duplicate Buying Risk",
                    "description": "You have 2 unopened units of Dove Shampoo and 1 unopened Vitamin C.",
                    "possible_saving": 770.0
                }
            })

        elif path == "/api/analytics":
            return self.send_json({
                "monthly_summary": {
                    "spent": 4200.0,
                    "saved": 1247.0,
                    "avoided_purchases": 3,
                    "utilization_rate": "92%"
                },
                "spending_trend": {
                    "labels": ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
                    "data": [5100, 4800, 4300, 4900, 4400, 4200]
                },
                "waste_trend": {
                    "labels": ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
                    "data": [850, 600, 720, 450, 300, 150]
                },
                "category_breakdown": {
                    "labels": ["Personal Care", "Medicines & Supplements", "Cleaning", "Household"],
                    "data": [45, 25, 20, 10]
                }
            })

        elif path == "/api/expenditure/history":
            history = get_monthly_history_data()
            total_spent_6m = sum(m["spending"] for m in history)
            total_saved_6m = sum(m["money_saved"] for m in history)
            total_wasted_6m = sum(m["waste_value"] for m in history)
            total_consumed_6m = sum(m["money_consumed"] for m in history)
            return self.send_json({
                "months": history,
                "summary": {
                    "total_spent_6m": round(total_spent_6m, 2),
                    "total_saved_6m": round(total_saved_6m, 2),
                    "total_wasted_6m": round(total_wasted_6m, 2),
                    "total_consumed_6m": round(total_consumed_6m, 2),
                    "total_months": len(history)
                }
            })

        elif path == "/api/expenditure/monthly":
            hh_id = int(query.get("household_id", [1])[0])
            req_month = query.get("month", [None])[0]
            now = datetime.now()
            current_month_prefix = now.strftime("%Y-%m")

            # Historical month query
            if req_month and req_month != current_month_prefix:
                m_data = get_monthly_history_data(req_month)
                if m_data:
                    return self.send_json(m_data)

            month_label = now.strftime("%B %Y")

            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM products WHERE household_id = ?;", (hh_id,))
                inventory = [dict(p) for p in cur.fetchall()]

                # Total procurement spending
                cur.execute("SELECT SUM(price * quantity) FROM products WHERE household_id = ?;", (hh_id,))
                total_spent = float(cur.fetchone()[0] or 0.0)

                # Money consumed this month
                cur.execute("""
                    SELECT SUM(cost) FROM consumption_logs 
                    WHERE household_id = ? AND status = 'consumed'
                    AND (logged_at LIKE ? OR finish_date LIKE ?);
                """, (hh_id, f"{current_month_prefix}%", f"{current_month_prefix}%"))
                money_consumed = float(cur.fetchone()[0] or 0.0)

                # Wasted value this month
                cur.execute("""
                    SELECT SUM(cost) FROM consumption_logs 
                    WHERE household_id = ? AND status = 'wasted'
                    AND (logged_at LIKE ? OR start_date LIKE ?);
                """, (hh_id, f"{current_month_prefix}%", f"{current_month_prefix}%"))
                wasted_value = float(cur.fetchone()[0] or 0.0)

                # Wasted items detail: "wasted and on what"
                cur.execute("""
                    SELECT id, product_name, category, cost, wasted_reason, logged_at
                    FROM consumption_logs
                    WHERE household_id = ? AND status = 'wasted'
                    ORDER BY id DESC;
                """, (hh_id,))
                wasted_items = [dict(r) for r in cur.fetchall()]

                # Monthly usage statistics
                cur.execute("""
                    SELECT COUNT(*) FROM consumption_logs 
                    WHERE household_id = ? AND status = 'consumed'
                    AND (logged_at LIKE ? OR finish_date LIKE ?);
                """, (hh_id, f"{current_month_prefix}%", f"{current_month_prefix}%"))
                units_consumed_this_month = int(cur.fetchone()[0] or 0)

            in_use_units = sum(p.get("in_use_quantity", 0) for p in inventory)
            unopened_units = sum(p.get("unopened_quantity", 0) for p in inventory)

            # AI Analysis for savings & unnecessary purchases
            analysis = recommender.analyze_inventory(inventory, household_size=3)
            money_saved = analysis.get("total_avoided_spend", 1600.0)
            avoid_list = analysis.get("avoid_buying", [])

            unnecessary_purchases = []
            for a in avoid_list:
                if a.get("unopened_count", 0) >= 1:
                    unnecessary_purchases.append({
                        "product_name": a["name"],
                        "category": a.get("category", "General"),
                        "unopened_count": a["unopened_count"],
                        "supply_runway_days": a["supply_runway_days"],
                        "cost": a.get("price", 0.0),
                        "flag_reason": f"Already have {a['unopened_count']} unopened backup (~{a['supply_runway_days']}d stock remaining)"
                    })

            potential_savings = sum(p["cost"] for p in unnecessary_purchases)
            if potential_savings == 0:
                potential_savings = money_saved

            cur_sample = SAMPLE_MONTHLY_HISTORY[0]
            if not wasted_items and cur_sample.get("wasted_items"):
                wasted_items = cur_sample["wasted_items"]
                if wasted_value == 0:
                    wasted_value = cur_sample["waste_value"]

            consumed_items = cur_sample.get("consumed_items", [])

            return self.send_json({
                "month_key": current_month_prefix,
                "month_label": month_label,
                "is_current": True,
                "spending": round(total_spent or cur_sample["spending"], 2),
                "money_saved": round(money_saved, 2),
                "money_consumed": round(money_consumed or cur_sample["money_consumed"], 2),
                "waste_value": round(wasted_value, 2),
                "wasted_items": wasted_items,
                "consumed_items": consumed_items,
                "potential_savings": round(potential_savings, 2),
                "unnecessary_purchases": unnecessary_purchases or cur_sample.get("unnecessary_purchases", []),
                "monthly_usage": {
                    "units_consumed_this_month": units_consumed_this_month or cur_sample["units_consumed"],
                    "currently_in_use_units": in_use_units or cur_sample["monthly_usage"]["currently_in_use_units"],
                    "unopened_backup_units": unopened_units or cur_sample["monthly_usage"]["unopened_backup_units"],
                    "active_product_types": len(inventory) or cur_sample["monthly_usage"]["active_product_types"]
                }
            })

        elif path == "/api/notifications":
            with db.get_connection() as conn:
                cur = conn.cursor()
                # Dynamically generate smart notifications based on live inventory state
                today = date.today()
                now = datetime.now()
                hh_id = 1

                cur.execute("SELECT * FROM products WHERE household_id = ?;", (hh_id,))
                products = [dict(p) for p in cur.fetchall()]

                cur.execute("SELECT title FROM notifications WHERE household_id = ?;", (hh_id,))
                existing_titles = {row[0].lower() for row in cur.fetchall()}

                new_notifs = []

                # 1. Expired Products & Expiring Soon Products
                for p in products:
                    exp = p.get("expiry_date")
                    if exp:
                        try:
                            exp_date = date.fromisoformat(exp)
                            diff = (exp_date - today).days
                            if diff < 0:
                                t = f"Expired: {p['name']}"
                                if t.lower() not in existing_titles:
                                    new_notifs.append((
                                        hh_id, 1, "expired", t,
                                        f"{p['name']} passed its expiry date {abs(diff)} days ago ({exp}). Safe disposal or replacement advised.",
                                        "View Item"
                                    ))
                                    existing_titles.add(t.lower())
                            elif 0 <= diff <= 14:
                                t = f"Expiring Soon: {p['name']}"
                                if t.lower() not in existing_titles:
                                    new_notifs.append((
                                        hh_id, 1, "expiring_soon", t,
                                        f"{p['name']} will expire in {diff} days ({exp}). Prioritize using it before it spoils.",
                                        "View Item"
                                    ))
                                    existing_titles.add(t.lower())
                        except Exception:
                            pass

                # 2. Need to Buy: Products that are finished / 0 quantity
                finished_seen = set()
                for p in products:
                    p_name = (p.get("name") or "").strip()
                    if p.get("quantity", 0) == 0 or p.get("status") == "finished":
                        if p_name.lower() in finished_seen:
                            continue
                        finished_seen.add(p_name.lower())
                        t = f"Need to Buy: {p_name}"
                        if t.lower() not in existing_titles:
                            new_notifs.append((
                                hh_id, 1, "need_to_buy", t,
                                f"{p_name} is finished / out of stock (0 units remaining). Add it to your restock list.",
                                "Restock Now"
                            ))
                            existing_titles.add(t.lower())

                # 3. Monthly Spend Notification on Month End
                month_name = now.strftime("%B")
                cur.execute("SELECT SUM(price * quantity) FROM products WHERE household_id = ?;", (hh_id,))
                total_spent = float(cur.fetchone()[0] or 0.0)
                m_title = f"{month_name} Monthly Spending Summary"
                if m_title.lower() not in existing_titles:
                    new_notifs.append((
                        hh_id, 1, "monthly_spent", m_title,
                        f"Month-end financial update: Your household spent ₹ {int(total_spent):,} on home essentials for {month_name}. Check your monthly breakdown for savings and waste reduction!",
                        "View Summary"
                    ))
                    existing_titles.add(m_title.lower())

                if new_notifs:
                    cur.executemany("""
                        INSERT INTO notifications (household_id, user_id, type, title, message, action_text, is_read)
                        VALUES (?, ?, ?, ?, ?, ?, 0);
                    """, new_notifs)
                    conn.commit()

                cur.execute("SELECT * FROM notifications WHERE household_id = ? ORDER BY id DESC LIMIT 30;", (hh_id,))
                return self.send_json([dict(n) for n in cur.fetchall()])

        return self.send_json({"detail": "Not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if path == "/api/products":
            today_str = date.today().isoformat()
            qty = int(body.get("quantity", 1))
            unopened = int(body.get("unopened_quantity", qty))
            in_use = int(body.get("in_use_quantity", 0))
            status = "in_use" if in_use > 0 else "unopened"

            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO products (
                        household_id, user_id, name, brand, category, quantity,
                        unopened_quantity, in_use_quantity, price, purchase_date,
                        opened_date, expiry_date, visibility, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    1, 1, body.get("name"), body.get("brand"), body.get("category", "Personal Care"),
                    qty, unopened, in_use, float(body.get("price", 0.0)),
                    today_str, today_str if in_use > 0 else None,
                    body.get("expiry_date"), body.get("visibility", "shared"), status
                ))
                conn.commit()
                new_id = cur.lastrowid
            return self.send_json({"success": True, "id": new_id, "message": "Product added successfully!"})

        elif path == "/api/products/classify":
            img = body.get("image_base64")
            fname = body.get("filename", "")
            hint = body.get("text_hint", "")
            res = product_categorizer.classify_image_data(image_base64_or_bytes=img, filename=fname, text_hint=hint)
            return self.send_json({"success": True, **res})

        elif path == "/api/products/batch-delete":
            ids = body.get("ids", [])
            if not isinstance(ids, list):
                return self.send_json({"detail": "Invalid ids list"}, 400)
            int_ids = [int(i) for i in ids if str(i).isdigit()]
            if int_ids:
                placeholders = ",".join("?" for _ in int_ids)
                with db.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(f"DELETE FROM products WHERE id IN ({placeholders});", int_ids)
                    conn.commit()
            return self.send_json({"success": True, "deleted_count": len(int_ids)})

        elif path.startswith("/api/products/") and not path.endswith("/action"):
            parts = path.split("/")
            if len(parts) >= 4 and parts[3].isdigit():
                prod_id = int(parts[3])
                name = (body.get("name") or "").strip()
                category = body.get("category")
                with db.get_connection() as conn:
                    cur = conn.cursor()
                    if name and category:
                        cur.execute("UPDATE products SET name = ?, category = ? WHERE id = ?;", (name, category, prod_id))
                    elif name:
                        cur.execute("UPDATE products SET name = ? WHERE id = ?;", (name, prod_id))
                    conn.commit()
                return self.send_json({"success": True, "message": "Product updated successfully"})

        elif "/action" in path and path.startswith("/api/products/"):
            parts = path.split("/")
            prod_id = int(parts[3])
            action = body.get("action")
            waste_reason = body.get("waste_reason") or "Expired or unusable"
            today_str = date.today().isoformat()

            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM products WHERE id = ?;", (prod_id,))
                prod = cur.fetchone()
                if not prod:
                    return self.send_json({"detail": "Product not found"}, 404)

                prod = dict(prod)
                unopened = prod["unopened_quantity"]
                in_use = prod["in_use_quantity"]
                qty = prod["quantity"]
                price = float(prod.get("price") or 0.0)

                if action == "start_using" and unopened > 0:
                    unopened -= 1
                    in_use += 1
                    cur.execute("""
                        UPDATE products 
                        SET unopened_quantity = ?, in_use_quantity = ?, opened_date = ?, status = 'in_use'
                        WHERE id = ?;
                    """, (unopened, in_use, today_str, prod_id))
                elif action == "mark_finished" and in_use > 0:
                    in_use -= 1
                    qty = max(0, qty - 1)
                    new_status = "in_use" if in_use > 0 else ("unopened" if unopened > 0 else "finished")
                    cur.execute("""
                        UPDATE products 
                        SET in_use_quantity = ?, quantity = ?, finished_date = ?, status = ?
                        WHERE id = ?;
                    """, (in_use, qty, today_str, new_status, prod_id))

                    # Log to consumption_logs
                    cur.execute("""
                        INSERT INTO consumption_logs 
                        (household_id, product_id, product_name, category, start_date, finish_date, duration_days, status, cost)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'consumed', ?);
                    """, (prod.get("household_id", 1), prod_id, prod["name"], prod["category"], prod.get("opened_date"), today_str, 30, price))

                elif action == "mark_wasted":
                    qty = max(0, qty - 1)
                    if in_use > 0:
                        in_use -= 1
                    elif unopened > 0:
                        unopened -= 1
                    new_status = "in_use" if in_use > 0 else ("unopened" if unopened > 0 else "discarded")
                    cur.execute("""
                        UPDATE products 
                        SET in_use_quantity = ?, unopened_quantity = ?, quantity = ?, status = ?
                        WHERE id = ?;
                    """, (in_use, unopened, qty, new_status, prod_id))

                    # Log to consumption_logs
                    cur.execute("""
                        INSERT INTO consumption_logs 
                        (household_id, product_id, product_name, category, duration_days, status, wasted_reason, cost)
                        VALUES (?, ?, ?, ?, 0, 'wasted', ?, ?);
                    """, (prod.get("household_id", 1), prod_id, prod["name"], prod["category"], waste_reason, price))

                conn.commit()

            return self.send_json({"success": True})

        elif path == "/api/ingredients/analyze":
            txt = body.get("ingredient_text") or ""
            img = body.get("image_base64")
            res = ingredient_analyzer.analyze_ingredients(txt, image_base64=img)
            return self.send_json(res)

        elif path == "/api/products/classify":
            img = body.get("image_base64")
            fname = body.get("filename", "")
            hint = body.get("text_hint", "")
            res = product_categorizer.classify_image_data(image_base64_or_bytes=img, filename=fname, text_hint=hint)
            return self.send_json({"success": True, **res})

        elif path == "/api/products/batch-delete":
            ids = body.get("ids", [])
            if not isinstance(ids, list):
                return self.send_json({"detail": "Invalid ids list"}, 400)
            int_ids = [int(i) for i in ids if str(i).isdigit()]
            if int_ids:
                placeholders = ",".join("?" for _ in int_ids)
                with db.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(f"DELETE FROM products WHERE id IN ({placeholders});", int_ids)
                    conn.commit()
            return self.send_json({"success": True, "deleted_count": len(int_ids)})

        elif path == "/api/categories/rename":
            old_name = (body.get("old_name") or "").strip()
            new_name = (body.get("new_name") or "").strip()
            if not old_name or not new_name:
                return self.send_json({"detail": "Old and new category names required"}, 400)
            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("UPDATE products SET category = ? WHERE LOWER(category) = LOWER(?);", (new_name, old_name))
                updated = cur.rowcount
                conn.commit()
            return self.send_json({"success": True, "updated_count": updated, "message": f"Renamed category to {new_name}"})

        elif path == "/api/household/join":
            code = body.get("share_code", "").strip().upper()
            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM households WHERE UPPER(share_code) = ?;", (code,))
                hh = cur.fetchone()
                if not hh:
                    return self.send_json({"detail": "Household code not found"}, 404)
                return self.send_json({"success": True, "message": f"Joined {hh['name']}!"})

        elif path == "/api/household/rename":
            hh_id = int(body.get("household_id", 1))
            new_name = (body.get("name") or "").strip()
            if not new_name:
                return self.send_json({"detail": "Household name cannot be empty"}, 400)
            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("UPDATE households SET name = ? WHERE id = ?;", (new_name, hh_id))
                conn.commit()
            return self.send_json({"success": True, "name": new_name, "message": "Household name updated successfully"})

        elif path.startswith("/api/notifications/") and path.endswith("/read"):
            parts = path.split("/")
            if len(parts) >= 4 and parts[3].isdigit():
                notif_id = int(parts[3])
                with db.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("UPDATE notifications SET is_read = 1 WHERE id = ?;", (notif_id,))
                    conn.commit()
                return self.send_json({"success": True, "message": "Notification marked as read"})

        elif path == "/api/notifications/read-all":
            with db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("UPDATE notifications SET is_read = 1 WHERE household_id = 1;")
                conn.commit()
            return self.send_json({"success": True, "message": "All notifications marked as read"})

        return self.send_json({"detail": "Not found"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/products/"):
            parts = path.split("/")
            if len(parts) >= 4 and parts[3].isdigit():
                prod_id = int(parts[3])
                with db.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM products WHERE id = ?;", (prod_id,))
                    conn.commit()
                return self.send_json({"success": True, "message": "Product deleted successfully"})

        return self.send_json({"detail": "Not found"}, 404)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            raw = self.rfile.read(content_length)
            return json.loads(raw.decode("utf-8"))
        return {}

    def send_json(self, data, status=200, is_head=False):
        content = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if not is_head:
            self.wfile.write(content)

    def serve_file(self, path, content_type=None, is_head=False):
        if not os.path.exists(path):
            return self.send_json({"detail": "File not found"}, 404, is_head=is_head)
        if not content_type:
            if path.endswith(".css"): content_type = "text/css"
            elif path.endswith(".js"): content_type = "application/javascript"
            elif path.endswith(".html"): content_type = "text/html"
            elif path.endswith(".json"): content_type = "application/json"
            elif path.endswith(".svg"): content_type = "image/svg+xml"
            elif path.endswith(".png"): content_type = "image/png"
            elif path.endswith(".jpg") or path.endswith(".jpeg"): content_type = "image/jpeg"
            else: content_type = "text/plain"

        try:
            with open(path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if not is_head:
                self.wfile.write(data)
        except Exception as e:
            return self.send_json({"detail": f"Error reading file: {str(e)}"}, 500, is_head=is_head)

class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True

def free_port(port: int):
    """Attempts to free the specified port by terminating any existing process using it."""
    try:
        out = subprocess.check_output(["lsof", "-ti", f":{port}"], stderr=subprocess.DEVNULL).decode().strip()
        for pid in out.split():
            if pid and int(pid) != os.getpid():
                print(f"[Port] Freeing port {port} (stopping lingering PID {pid})...")
                try:
                    os.kill(int(pid), 9)
                except Exception:
                    pass
        time.sleep(0.5)
    except Exception:
        pass

def run_server(port=8000):
    server_address = ("0.0.0.0", port)
    try:
        httpd = ReusableHTTPServer(server_address, SmartShelfRequestHandler)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"[Port] Port {port} is in use. Automatically reclaiming port {port}...")
            free_port(port)
            try:
                httpd = ReusableHTTPServer(server_address, SmartShelfRequestHandler)
            except OSError:
                port = port + 1
                server_address = ("0.0.0.0", port)
                httpd = ReusableHTTPServer(server_address, SmartShelfRequestHandler)
                print(f"[Port] Switched to fallback port: http://localhost:{port}")
        else:
            raise e

    print(f"[SmartShelf] Running live on http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[SmartShelf] Server stopped.")
        httpd.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)
