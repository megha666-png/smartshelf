"""
Realistic pre-seeded household dataset for SmartShelf demonstration.
Represents "The Sharma Home" (SHLF-4829) focusing on Personal Care, Cleaning,
Medicines & Supplements, and General Household goods.
"""

from datetime import datetime, timedelta, date

SAMPLE_HOUSEHOLD = {
    "name": "The Sharma Home",
    "share_code": "SHLF-4829",
    "members": [
        {"name": "Alex Sharma", "email": "alex@smartshelf.io", "role": "admin"},
        {"name": "Priya Sharma", "email": "priya@smartshelf.io", "role": "member"},
        {"name": "Rohan Sharma", "email": "rohan@smartshelf.io", "role": "member"},
    ]
}

# Consumption history for machine learning consumption rate training
SAMPLE_CONSUMPTION_HISTORY = [
    # Dove Shampoo (Personal Care) -> ~40 days
    {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "duration_days": 40, "status": "consumed", "cost": 450},
    {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "duration_days": 42, "status": "consumed", "cost": 450},
    {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "duration_days": 38, "status": "consumed", "cost": 450},
    {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "duration_days": 41, "status": "consumed", "cost": 450},

    # Neem Face Wash (Personal Care) -> ~35 days
    {"product_name": "Himalaya Purifying Neem Face Wash", "category": "Personal Care", "duration_days": 34, "status": "consumed", "cost": 240},
    {"product_name": "Himalaya Purifying Neem Face Wash", "category": "Personal Care", "duration_days": 36, "status": "consumed", "cost": 240},
    {"product_name": "Himalaya Purifying Neem Face Wash", "category": "Personal Care", "duration_days": 35, "status": "consumed", "cost": 240},

    # Colgate Toothpaste (Personal Care) -> ~25 days
    {"product_name": "Colgate Total Toothpaste", "category": "Personal Care", "duration_days": 24, "status": "consumed", "cost": 120},
    {"product_name": "Colgate Total Toothpaste", "category": "Personal Care", "duration_days": 26, "status": "consumed", "cost": 120},
    {"product_name": "Colgate Total Toothpaste", "category": "Personal Care", "duration_days": 25, "status": "consumed", "cost": 120},

    # Cetaphil Moisturizer (Personal Care) -> ~50 days
    {"product_name": "Cetaphil Daily Hydrating Moisturizer", "category": "Personal Care", "duration_days": 48, "status": "consumed", "cost": 650},
    {"product_name": "Cetaphil Daily Hydrating Moisturizer", "category": "Personal Care", "duration_days": 52, "status": "consumed", "cost": 650},
    {"product_name": "Cetaphil Daily Hydrating Moisturizer", "category": "Personal Care", "duration_days": 35, "status": "wasted", "cost": 650, "reason": "Expired before finishing"},

    # Liquid Detergent (Cleaning) -> ~21 days
    {"product_name": "Ariel Matic Liquid Detergent", "category": "Cleaning", "duration_days": 20, "status": "consumed", "cost": 420},
    {"product_name": "Ariel Matic Liquid Detergent", "category": "Cleaning", "duration_days": 22, "status": "consumed", "cost": 420},
    {"product_name": "Ariel Matic Liquid Detergent", "category": "Cleaning", "duration_days": 21, "status": "consumed", "cost": 420},

    # Vim Dishwashing Gel (Cleaning) -> ~30 days
    {"product_name": "Vim Lemon Dishwashing Gel", "category": "Cleaning", "duration_days": 30, "status": "consumed", "cost": 180},
    {"product_name": "Vim Lemon Dishwashing Gel", "category": "Cleaning", "duration_days": 29, "status": "consumed", "cost": 180},

    # Vitamin C & Zinc Tablets (Medicines & Supplements) -> ~60 days
    {"product_name": "Vitamin C & Zinc Chewable Tablets", "category": "Medicines & Supplements", "duration_days": 58, "status": "consumed", "cost": 320},
    {"product_name": "Vitamin C & Zinc Chewable Tablets", "category": "Medicines & Supplements", "duration_days": 62, "status": "consumed", "cost": 320},

    # Paracetamol 650mg (Medicines & Supplements) -> ~90 days
    {"product_name": "Paracetamol 650mg Fast Relief", "category": "Medicines & Supplements", "duration_days": 85, "status": "consumed", "cost": 45},
]

# Baseline category consumption rates (excluding groceries/food; including medicines & supplements)
CATEGORY_BASELINES_DAYS = {
    "Personal Care": 35,
    "Cleaning": 25,
    "Medicines & Supplements": 60,
    "Household": 30,
    "Other": 30
}

def get_initial_products():
    """Generates the active inventory products with realistic dates and without food/groceries."""
    today = date.today()
    return [
        {
            "name": "Dove Moisture Shampoo",
            "brand": "Dove",
            "category": "Personal Care",
            "quantity": 3,
            "unopened_quantity": 2,
            "in_use_quantity": 1,
            "purchase_date": (today - timedelta(days=16)).isoformat(),
            "opened_date": (today - timedelta(days=16)).isoformat(),
            "price": 450.0,
            "expiry_date": (today + timedelta(days=450)).isoformat(),
            "visibility": "shared",
            "barcode": "8901030739121",
            "image_url": None,
            "status": "in_use"
        },
        {
            "name": "Himalaya Purifying Neem Face Wash",
            "brand": "Himalaya",
            "category": "Personal Care",
            "quantity": 1,
            "unopened_quantity": 0,
            "in_use_quantity": 1,
            "purchase_date": (today - timedelta(days=22)).isoformat(),
            "opened_date": (today - timedelta(days=22)).isoformat(),
            "price": 240.0,
            "expiry_date": (today + timedelta(days=280)).isoformat(),
            "visibility": "personal",
            "barcode": "8901138501188",
            "image_url": None,
            "status": "in_use"
        },
        {
            "name": "Colgate Total Toothpaste",
            "brand": "Colgate",
            "category": "Personal Care",
            "quantity": 0,
            "unopened_quantity": 0,
            "in_use_quantity": 0,
            "purchase_date": (today - timedelta(days=35)).isoformat(),
            "opened_date": (today - timedelta(days=32)).isoformat(),
            "finished_date": (today - timedelta(days=2)).isoformat(),
            "price": 120.0,
            "expiry_date": (today + timedelta(days=300)).isoformat(),
            "visibility": "shared",
            "barcode": "8901314010545",
            "image_url": None,
            "status": "finished"
        },
        {
            "name": "Cetaphil Daily Hydrating Moisturizer",
            "brand": "Cetaphil",
            "category": "Personal Care",
            "quantity": 1,
            "unopened_quantity": 1,
            "in_use_quantity": 0,
            "purchase_date": (today - timedelta(days=75)).isoformat(),
            "price": 650.0,
            "expiry_date": (today + timedelta(days=28)).isoformat(), # Only 28 days left, typical consumption is ~50 days! High waste risk!
            "visibility": "personal",
            "barcode": "3499320008502",
            "image_url": None,
            "status": "unopened"
        },
        {
            "name": "Ariel Matic Liquid Detergent",
            "brand": "Ariel",
            "category": "Cleaning",
            "quantity": 1,
            "unopened_quantity": 0,
            "in_use_quantity": 1,
            "purchase_date": (today - timedelta(days=18)).isoformat(),
            "opened_date": (today - timedelta(days=18)).isoformat(),
            "price": 420.0,
            "expiry_date": (today + timedelta(days=360)).isoformat(),
            "visibility": "shared",
            "barcode": "4902430752101",
            "image_url": None,
            "status": "in_use"
        },
        {
            "name": "Vim Lemon Dishwashing Gel",
            "brand": "Vim",
            "category": "Cleaning",
            "quantity": 2,
            "unopened_quantity": 1,
            "in_use_quantity": 1,
            "purchase_date": (today - timedelta(days=14)).isoformat(),
            "opened_date": (today - timedelta(days=14)).isoformat(),
            "price": 180.0,
            "expiry_date": (today + timedelta(days=240)).isoformat(),
            "visibility": "shared",
            "barcode": "8901030382914",
            "image_url": None,
            "status": "in_use"
        },
        {
            "name": "Vitamin C & Zinc Chewable Tablets",
            "brand": "Limcee",
            "category": "Medicines & Supplements",
            "quantity": 2,
            "unopened_quantity": 1,
            "in_use_quantity": 1,
            "purchase_date": (today - timedelta(days=20)).isoformat(),
            "opened_date": (today - timedelta(days=15)).isoformat(),
            "price": 320.0,
            "expiry_date": (today + timedelta(days=365)).isoformat(),
            "visibility": "shared",
            "barcode": "8901234567890",
            "image_url": None,
            "status": "in_use"
        },
        {
            "name": "Paracetamol 650mg Fast Relief",
            "brand": "Dolo",
            "category": "Medicines & Supplements",
            "quantity": 1,
            "unopened_quantity": 1,
            "in_use_quantity": 0,
            "purchase_date": (today - timedelta(days=30)).isoformat(),
            "price": 45.0,
            "expiry_date": (today + timedelta(days=500)).isoformat(),
            "visibility": "shared",
            "barcode": "8901111222333",
            "image_url": None,
            "status": "unopened"
        }
    ]

# Multi-Month Historical Household Financial & Waste Breakdown
SAMPLE_MONTHLY_HISTORY = [
    {
        "month_key": "2026-10",
        "month_label": "October 2026",
        "is_current": True,
        "spending": 4200.0,
        "money_saved": 1600.0,
        "money_consumed": 3850.0,
        "waste_value": 650.0,
        "units_consumed": 8,
        "units_wasted": 1,
        "wasted_items": [
            {
                "id": 101,
                "product_name": "Cetaphil Daily Hydrating Moisturizer",
                "category": "Personal Care",
                "cost": 650.0,
                "wasted_reason": "Expired before finishing (bought duplicate backup too early)",
                "logged_at": "2026-10-04 14:30:00"
            }
        ],
        "consumed_items": [
            {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "cost": 450.0, "duration_days": 40},
            {"product_name": "Ariel Matic Liquid Detergent", "category": "Cleaning", "cost": 420.0, "duration_days": 21},
            {"product_name": "Colgate Total Toothpaste", "category": "Personal Care", "cost": 120.0, "duration_days": 25},
            {"product_name": "Vitamin C & Zinc Chewable Tablets", "category": "Medicines & Supplements", "cost": 320.0, "duration_days": 60},
            {"product_name": "Himalaya Neem Face Wash", "category": "Personal Care", "cost": 240.0, "duration_days": 35},
            {"product_name": "Vim Lemon Dishwashing Gel", "category": "Cleaning", "cost": 180.0, "duration_days": 30}
        ],
        "unnecessary_purchases": [
            {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "cost": 450.0, "flag_reason": "Already have 2 unopened units in backup stock (~80 days runway)"},
            {"product_name": "Ariel Matic Detergent", "category": "Cleaning", "cost": 420.0, "flag_reason": "Wait 5 days until current bottle drops below 10%"}
        ],
        "monthly_usage": {
            "units_consumed_this_month": 8,
            "currently_in_use_units": 6,
            "unopened_backup_units": 5,
            "active_product_types": 9
        }
    },
    {
        "month_key": "2026-09",
        "month_label": "September 2026",
        "is_current": False,
        "spending": 3650.0,
        "money_saved": 1450.0,
        "money_consumed": 3480.0,
        "waste_value": 320.0,
        "units_consumed": 7,
        "units_wasted": 1,
        "wasted_items": [
            {
                "id": 102,
                "product_name": "Herbal Ayurvedic Hair Oil",
                "category": "Personal Care",
                "cost": 320.0,
                "wasted_reason": "Expired in cabinet due to duplicate purchase",
                "logged_at": "2026-09-18 11:20:00"
            }
        ],
        "consumed_items": [
            {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "cost": 450.0, "duration_days": 41},
            {"product_name": "Himalaya Purifying Neem Face Wash", "category": "Personal Care", "cost": 240.0, "duration_days": 36},
            {"product_name": "Paracetamol 650mg Relief", "category": "Medicines & Supplements", "cost": 45.0, "duration_days": 85},
            {"product_name": "Vim Lemon Dish Gel", "category": "Cleaning", "cost": 180.0, "duration_days": 29},
            {"product_name": "Colgate Total Toothpaste", "category": "Personal Care", "cost": 120.0, "duration_days": 26}
        ],
        "unnecessary_purchases": [
            {"product_name": "Himalaya Face Wash", "category": "Personal Care", "cost": 240.0, "flag_reason": "Unopened backup was already available"}
        ],
        "monthly_usage": {
            "units_consumed_this_month": 7,
            "currently_in_use_units": 5,
            "unopened_backup_units": 4,
            "active_product_types": 8
        }
    },
    {
        "month_key": "2026-08",
        "month_label": "August 2026",
        "is_current": False,
        "spending": 2980.0,
        "money_saved": 1820.0,
        "money_consumed": 3100.0,
        "waste_value": 0.0,
        "units_consumed": 6,
        "units_wasted": 0,
        "wasted_items": [],
        "consumed_items": [
            {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "cost": 450.0, "duration_days": 39},
            {"product_name": "Ariel Matic Liquid Detergent", "category": "Cleaning", "cost": 420.0, "duration_days": 22},
            {"product_name": "Colgate Total Toothpaste", "category": "Personal Care", "cost": 120.0, "duration_days": 24},
            {"product_name": "Duracell AA Alkaline Batteries", "category": "Household", "cost": 220.0, "duration_days": 90},
            {"product_name": "Lizol Floor Cleaner", "category": "Cleaning", "cost": 210.0, "duration_days": 30}
        ],
        "unnecessary_purchases": [
            {"product_name": "Duracell Batteries 16-pack", "category": "Household", "cost": 550.0, "flag_reason": "8 cells still in reserve"}
        ],
        "monthly_usage": {
            "units_consumed_this_month": 6,
            "currently_in_use_units": 5,
            "unopened_backup_units": 4,
            "active_product_types": 7
        }
    },
    {
        "month_key": "2026-07",
        "month_label": "July 2026",
        "is_current": False,
        "spending": 3420.0,
        "money_saved": 1150.0,
        "money_consumed": 3250.0,
        "waste_value": 280.0,
        "units_consumed": 6,
        "units_wasted": 1,
        "wasted_items": [
            {
                "id": 103,
                "product_name": "Exfoliating Walnut Face Scrub",
                "category": "Personal Care",
                "cost": 280.0,
                "wasted_reason": "Left uncapped and dried out",
                "logged_at": "2026-07-25 16:15:00"
            }
        ],
        "consumed_items": [
            {"product_name": "Himalaya Neem Face Wash", "category": "Personal Care", "cost": 240.0, "duration_days": 34},
            {"product_name": "Vim Dishwashing Gel", "category": "Cleaning", "cost": 180.0, "duration_days": 30},
            {"product_name": "Vitamin C & Zinc Chewable Tablets", "category": "Medicines & Supplements", "cost": 320.0, "duration_days": 58},
            {"product_name": "Dettol Antiseptic Liquid", "category": "Medicines & Supplements", "cost": 190.0, "duration_days": 45}
        ],
        "unnecessary_purchases": [],
        "monthly_usage": {
            "units_consumed_this_month": 6,
            "currently_in_use_units": 5,
            "unopened_backup_units": 3,
            "active_product_types": 7
        }
    },
    {
        "month_key": "2026-06",
        "month_label": "June 2026",
        "is_current": False,
        "spending": 3550.0,
        "money_saved": 980.0,
        "money_consumed": 3300.0,
        "waste_value": 140.0,
        "units_consumed": 5,
        "units_wasted": 1,
        "wasted_items": [
            {
                "id": 104,
                "product_name": "Good Knight Mosquito Vaporizer Refill",
                "category": "Household",
                "cost": 140.0,
                "wasted_reason": "Bottle leaked in utility cupboard",
                "logged_at": "2026-06-12 09:40:00"
            }
        ],
        "consumed_items": [
            {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "cost": 450.0, "duration_days": 42},
            {"product_name": "Ariel Matic Liquid Detergent", "category": "Cleaning", "cost": 420.0, "duration_days": 20},
            {"product_name": "Colgate Total Toothpaste", "category": "Personal Care", "cost": 120.0, "duration_days": 25}
        ],
        "unnecessary_purchases": [],
        "monthly_usage": {
            "units_consumed_this_month": 5,
            "currently_in_use_units": 4,
            "unopened_backup_units": 4,
            "active_product_types": 6
        }
    },
    {
        "month_key": "2026-05",
        "month_label": "May 2026",
        "is_current": False,
        "spending": 3900.0,
        "money_saved": 750.0,
        "money_consumed": 3520.0,
        "waste_value": 350.0,
        "units_consumed": 5,
        "units_wasted": 1,
        "wasted_items": [
            {
                "id": 105,
                "product_name": "D-Tan Face Pack",
                "category": "Personal Care",
                "cost": 350.0,
                "wasted_reason": "Expired past safe shelf life",
                "logged_at": "2026-05-28 17:05:00"
            }
        ],
        "consumed_items": [
            {"product_name": "Dove Moisture Shampoo", "category": "Personal Care", "cost": 450.0, "duration_days": 38},
            {"product_name": "Vim Lemon Dish Gel", "category": "Cleaning", "cost": 180.0, "duration_days": 30},
            {"product_name": "Dettol Soap 3-Pack", "category": "Personal Care", "cost": 180.0, "duration_days": 40}
        ],
        "unnecessary_purchases": [],
        "monthly_usage": {
            "units_consumed_this_month": 5,
            "currently_in_use_units": 4,
            "unopened_backup_units": 3,
            "active_product_types": 6
        }
    }
]

def get_monthly_history_data(month_key: str = None):
    """Returns requested month or full list of monthly financial history."""
    if month_key:
        for m in SAMPLE_MONTHLY_HISTORY:
            if m["month_key"] == month_key:
                return m
        # Fallback to current
        return SAMPLE_MONTHLY_HISTORY[0]
    return SAMPLE_MONTHLY_HISTORY
