"""
SmartShelf Relational Database Layer.
Thread-safe SQLite implementation supporting users, households, products,
consumption logs, and smart notifications.
"""

import sqlite3
import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
try:
    from ml.datasets.household_sample_data import (
        SAMPLE_HOUSEHOLD,
        SAMPLE_CONSUMPTION_HISTORY,
        get_initial_products
    )
except ImportError:
    from smartshelf.ml.datasets.household_sample_data import (
        SAMPLE_HOUSEHOLD,
        SAMPLE_CONSUMPTION_HISTORY,
        get_initial_products
    )

DB_FILE = os.path.join(os.path.dirname(__file__), "smartshelf.db")

class Database:
    def __init__(self, db_path: str = DB_FILE):
        self.db_path = db_path
        self._init_tables()
        self._seed_if_empty()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_tables(self):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS households (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                share_code TEXT UNIQUE NOT NULL,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS household_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                household_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT DEFAULT 'member',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (household_id) REFERENCES households(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                household_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                brand TEXT,
                category TEXT NOT NULL,
                quantity INTEGER DEFAULT 1,
                unopened_quantity INTEGER DEFAULT 1,
                in_use_quantity INTEGER DEFAULT 0,
                price REAL DEFAULT 0.0,
                purchase_date TEXT,
                opened_date TEXT,
                finished_date TEXT,
                expiry_date TEXT,
                visibility TEXT DEFAULT 'shared',
                status TEXT DEFAULT 'unopened',
                barcode TEXT,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (household_id) REFERENCES households(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS consumption_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                household_id INTEGER,
                product_id INTEGER,
                product_name TEXT NOT NULL,
                category TEXT NOT NULL,
                start_date TEXT,
                finish_date TEXT,
                duration_days INTEGER NOT NULL,
                status TEXT DEFAULT 'consumed',
                wasted_reason TEXT,
                cost REAL DEFAULT 0.0,
                logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                household_id INTEGER NOT NULL,
                user_id INTEGER,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                action_text TEXT,
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            conn.commit()

    def _seed_if_empty(self):
        """Pre-seeds the database with the Sharma Home demo dataset if first launch."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM users;")
            if cur.fetchone()[0] > 0:
                return  # already seeded

            # Create default users
            user_ids = []
            for m in SAMPLE_HOUSEHOLD["members"]:
                cur.execute(
                    "INSERT INTO users (name, email, password) VALUES (?, ?, ?);",
                    (m["name"], m["email"], "password123")
                )
                user_ids.append(cur.lastrowid)

            primary_user_id = user_ids[0]

            # Create Household
            cur.execute(
                "INSERT INTO households (name, share_code, created_by) VALUES (?, ?, ?);",
                (SAMPLE_HOUSEHOLD["name"], SAMPLE_HOUSEHOLD["share_code"], primary_user_id)
            )
            hh_id = cur.lastrowid

            # Add members to household
            for idx, u_id in enumerate(user_ids):
                role = SAMPLE_HOUSEHOLD["members"][idx]["role"]
                cur.execute(
                    "INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?);",
                    (hh_id, u_id, role)
                )

            # Insert sample consumption history
            for log in SAMPLE_CONSUMPTION_HISTORY:
                cur.execute("""
                INSERT INTO consumption_logs 
                (household_id, product_name, category, duration_days, status, cost, wasted_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?);
                """, (
                    hh_id,
                    log["product_name"],
                    log["category"],
                    log["duration_days"],
                    log["status"],
                    log.get("cost", 0.0),
                    log.get("reason")
                ))

            # Insert initial inventory products
            for p in get_initial_products():
                cur.execute("""
                INSERT INTO products 
                (household_id, user_id, name, brand, category, quantity, 
                 unopened_quantity, in_use_quantity, price, purchase_date, 
                 opened_date, finished_date, expiry_date, visibility, status, barcode, image_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    hh_id,
                    primary_user_id,
                    p["name"],
                    p.get("brand"),
                    p["category"],
                    p["quantity"],
                    p.get("unopened_quantity", 0),
                    p.get("in_use_quantity", 0),
                    p.get("price", 0.0),
                    p.get("purchase_date"),
                    p.get("opened_date"),
                    p.get("finished_date"),
                    p.get("expiry_date"),
                    p.get("visibility", "shared"),
                    p.get("status", "unopened"),
                    p.get("barcode"),
                    p.get("image_url")
                ))

            # Add default notifications
            default_notifications = [
                (hh_id, primary_user_id, "inventory_alert", "Overstock Alert", "You already have 2 unopened Dove Shampoo bottles.", "View Details"),
                (hh_id, primary_user_id, "waste_risk", "Waste Prediction", "Cetaphil Moisturizer has a high possibility of being wasted based on your usage pattern.", "View Analysis"),
                (hh_id, primary_user_id, "purchase_rec", "Restock Recommendation", "Colgate Toothpaste stock is 0. Consider reordering soon.", "Add to Cart"),
                (hh_id, primary_user_id, "savings", "Good News", "You avoided ₹499 in unnecessary spending this month by waiting!", "View Insights")
            ]
            for n in default_notifications:
                cur.execute("""
                INSERT INTO notifications (household_id, user_id, type, title, message, action_text)
                VALUES (?, ?, ?, ?, ?, ?);
                """, n)

            conn.commit()

# Singleton instance
db = Database()
