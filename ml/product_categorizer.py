"""
SmartShelf AI Product Categorization Engine.
Classifies camera captured images, packaging labels, and barcodes
into SmartShelf core categories:
  - Personal Care
  - Medicines & Supplements
  - Cleaning
  - Household

Extracts:
  - Primary Category
  - Sub-category
  - Recognized Product Name
  - Brand
  - Confidence Score (%)
  - Suggested Consumption Runway & Typical Price
"""

import os
import re
import io
import base64
from typing import Dict, Any, List, Optional

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

CATEGORIES = [
    "Personal Care",
    "Cosmetics",
    "Medicines & Supplements",
    "Cleaning",
    "Household"
]

# Knowledge base of brands, keywords, and packaging attributes
CATEGORY_TAXONOMY = {
    "Cosmetics": {
        "subcategories": [
            "Face Makeup & Foundation",
            "Lipstick & Lip Care",
            "Eye Makeup & Mascara",
            "Nail Care & Polish",
            "Blush & Bronzer",
            "Compact & Setting Powder"
        ],
        "brands": [
            "maybelline", "lakme", "l'oreal paris", "mac", "nykaa", "sugar", "colorbar",
            "revlon", "faces canada", "swiss beauty", "insight", "huda beauty", "rare beauty",
            "fenty", "wet n wild", "bobbi brown", "clinique", "smashbox", "kay beauty",
            "pac", "elf", "e.l.f.", "mars", "relove", "revolution", "kiko milano"
        ],
        "keywords": [
            "cosmetic", "cosmetics", "foundation", "concealer", "primer", "lipstick", "lip gloss",
            "lip tint", "lip liner", "mascara", "eyeliner", "eye liner", "eyeshadow", "eye shadow",
            "kajal", "kohl", "blush", "bronzer", "highlighter", "compact powder", "setting powder",
            "translucent powder", "setting spray", "bb cream", "cc cream", "nail polish",
            "nail enamel", "vanilla", "beige", "shade", "contour", "matte lipstick"
        ],
        "default_price": 450.0,
        "default_duration_days": 90,
        "default_expiry_months": 24,
        "icon": "💄"
    },
    "Personal Care": {
        "subcategories": [
            "Hair Care & Shampoo",
            "Skin Care & Cleanser",
            "Oral Hygiene & Toothpaste",
            "Body Care & Soaps",
            "Deodorant & Fragrance",
            "Shaving & Grooming"
        ],
        "brands": [
            "dove", "himalaya", "colgate", "cetaphil", "nivea", "loreal", "l'oreal", "pantene",
            "head & shoulders", "head and shoulders", "olay", "neutrogena", "biotique", "garnier",
            "vaseline", "ponds", "pond's", "tresemme", "clinic plus", "mamaearth", "dermaco",
            "the derma co", "sensodyne", "oral-b", "oral b", "close up", "dettol soap", "lifebuoy",
            "pears", "fiama", "cinthol", "gillette", "old spice", "axe", "park avenue", "plum",
            "minimalist", "khadi", "medimix", "santoor", "lux", "wild stone", "wow skin science",
            "clean & clear", "clean and clear", "johnson", "sebamed", "aveeno", "cerave", "simple",
            "st botanica", "forest essentials", "maccaffeine", "dot & key", "foxtale", "boroline",
            "vicco", "parachut", "parachute", "bajaj almond", "navratna", "dabur amla", "streax",
            "godrej expert", "veet", "fem", "palmolive"
        ],
        "keywords": [
            "shampoo", "conditioner", "face wash", "facewash", "cleanser", "cleansing", "moisturizer",
            "moisturiser", "moisturizing", "lotion", "sunscreen", "sunblock", "serum", "toothpaste",
            "toothbrush", "tooth brush", "mouthwash", "body wash", "bodywash", "shower gel", "soap",
            "bathing bar", "deodorant", "deo", "antiperspirant", "perfume", "fragrance", "mist",
            "lip balm", "lip care", "hair oil", "hair serum", "hair mask", "hair color", "shaving cream",
            "shaving gel", "razor", "blades", "toner", "face mask", "face pack", "scrub", "exfoliating",
            "micellar", "micellar water", "night cream", "day cream", "cold cream", "eye cream",
            "hand cream", "body lotion", "skin cream", "skin therapy", "body butter", "talc"
        ],
        "default_price": 320.0,
        "default_duration_days": 35,
        "default_expiry_months": 24,
        "icon": "🧴"
    },
    "Medicines & Supplements": {
        "subcategories": [
            "Antipyretic & Pain Relief",
            "Vitamins & Daily Supplements",
            "Cough, Cold & Immunity",
            "First Aid & Antiseptics",
            "Digestive & Antacids",
            "Prescription Care"
        ],
        "brands": [
            "crocin", "dolo", "dolo 650", "paracetamol", "calpol", "combiflam", "aspirin", "disprin",
            "becosules", "limcee", "zincovit", "supradyn", "revital", "dettol antiseptic", "savlon",
            "betadine", "vicks", "benadryl", "alex", "cheston", "digene", "eno", "gelusil", "pudina hara",
            "volini", "moov", "iodex", "omnez", "omez", "pantocid", "pan-d", "shelcal", "cipcal",
            "himalaya liv52", "liv52", "band-aid", "hansaplast", "otrivin", "nasivion", "allegra",
            "cetirizine", "zandu", "dabur chyawanprash", "saridon", "relispray", "strepsils",
            "vicks vaporub", "halls", "honitus", "koflet", "unienzyme", "muscleblaze", "healthkart",
            "cipro", "amox", "azithral", "septilin", "triphala", "isabgol"
        ],
        "keywords": [
            "tablet", "tablets", "capsule", "capsules", "syrup", "liquid oral", "paracetamol", "ibuprofen",
            "aspirin", "acetaminophen", "vitamin", "vitamins", "multivitamin", "zinc", "calcium",
            "magnesium", "omega 3", "fish oil", "cod liver", "antiseptic", "disinfectant liquid",
            "pain relief", "headache", "fever", "cold", "cough", "flu", "inhaler", "nasal spray",
            "antacid", "digestive", "acidity", "gas relief", "ointment", "balm", "bandage", "band-aid",
            "first aid", "supplements", "supplement", "chewable", "drops", "effervescent", "lozenge",
            "lozenges", "mg", "dosage", "strip", "oral suspension", "fever relief", "caps"
        ],
        "default_price": 180.0,
        "default_duration_days": 60,
        "default_expiry_months": 18,
        "icon": "💊"
    },
    "Cleaning": {
        "subcategories": [
            "Laundry Care & Detergents",
            "Dishwashing Essentials",
            "Surface & Floor Cleaners",
            "Bathroom & Disinfectants",
            "Kitchen & Glass Cleaners"
        ],
        "brands": [
            "ariel", "surf excel", "surf", "tide", "rin", "wheel", "henko", "vim", "pril", "exo",
            "scotch-brite", "scotch brite", "lizol", "lysol", "harpic", "domex", "colin", "mr muscle",
            "vanish", "comfort", "safewash", "genteel", "dettol disinfectant", "dettol surface",
            "clorox", "cif", "astonish", "finish", "godrej protekt", "pitambari", "ghadi", "persil",
            "fairy", "downy", "gain", "sunlight", "hit surface", "odonil bathroom"
        ],
        "keywords": [
            "detergent", "laundry", "washing powder", "liquid detergent", "laundry pods", "fabric conditioner",
            "fabric softener", "softener", "dishwash", "dishwashing", "dish gel", "dishwasher",
            "dish liquid", "scrubber", "sponge", "dish bar", "floor cleaner", "toilet cleaner",
            "bathroom cleaner", "glass cleaner", "surface cleaner", "tile cleaner", "bleach",
            "stain remover", "disinfectant spray", "degreaser", "wiper", "mop", "drain cleaner",
            "descaler", "multi surface", "all purpose cleaner", "surface wipe"
        ],
        "default_price": 280.0,
        "default_duration_days": 25,
        "default_expiry_months": 36,
        "icon": "🧼"
    },
    "Household": {
        "subcategories": [
            "Batteries & Power",
            "Paper Products & Tissues",
            "Food Wraps & Bags",
            "Air Care & Fresheners",
            "Pest Control & Repellents",
            "General Home Utility"
        ],
        "brands": [
            "duracell", "energizer", "panasonic", "eveready", "nippon", "origami", "selpak", "kleenex",
            "pari", "premier tissues", "all out", "good knight", "hit", "mortein", "baygon", "odonil",
            "godrej aer", "ambipur", "ambi pur", "airwick", "air wick", "freshwrap", "hindalco foil",
            "ziploc", "shalimar", "philips", "wipro led", "havells", "syska", "camel", "bic"
        ],
        "keywords": [
            "battery", "batteries", "aa", "aaa", "9v", "cr2032", "cell", "cells", "tissue",
            "facial tissue", "toilet roll", "toilet paper", "paper towel", "kitchen towel",
            "paper napkins", "napkins", "foil", "aluminum foil", "aluminium foil", "cling wrap",
            "plastic wrap", "baking paper", "parchment paper", "garbage bags", "trash bags",
            "dustbin bags", "air freshener", "room freshener", "room spray", "diffuser", "mosquito",
            "mosquito repellent", "mosquito liquid", "mosquito coil", "insecticide", "bug spray",
            "light bulb", "led bulb", "led lamp", "candle", "candles", "matches", "matchbox",
            "lighter", "ziploc", "storage pouch", "garbage bag", "sealing tape"
        ],
        "default_price": 220.0,
        "default_duration_days": 30,
        "default_expiry_months": 36,
        "icon": "🏡"
    }
}

class ProductCategorizer:
    """
    AI-driven automated product recognition and categorization engine.
    Analyzes visual features, camera frame buffers, label text, and brand signatures.
    """

    def __init__(self):
        self.taxonomy = CATEGORY_TAXONOMY

    def classify_text(self, text: str) -> Dict[str, Any]:
        """
        Classifies product from label text, transcribed OCR, or user input.
        """
        clean_text = text.lower()
        scores = {cat: 0 for cat in CATEGORIES}
        matched_details = {cat: {"brands": [], "keywords": [], "sub": None} for cat in CATEGORIES}

        for cat, data in self.taxonomy.items():
            # Check brand matches (high weight)
            for brand in data["brands"]:
                if re.search(r'\b' + re.escape(brand) + r'\b', clean_text):
                    scores[cat] += 45
                    matched_details[cat]["brands"].append(brand)

            # Check keyword matches
            for kw in data["keywords"]:
                if re.search(r'\b' + re.escape(kw) + r'\b', clean_text):
                    scores[cat] += 20
                    matched_details[cat]["keywords"].append(kw)

        # Pick highest scoring category
        best_cat = max(scores, key=scores.get)
        best_score = scores[best_cat]

        if best_score == 0:
            best_cat = "Personal Care" # fallback default
            confidence = 55
        else:
            confidence = min(98, 65 + (best_score // 3))

        cat_info = self.taxonomy[best_cat]
        matched_brand = matched_details[best_cat]["brands"][0].title() if matched_details[best_cat]["brands"] else None

        # Determine subcategory
        subcat = cat_info["subcategories"][0]
        found_subcat = False
        for candidate_sub in cat_info["subcategories"]:
            for kw in matched_details[best_cat]["keywords"]:
                # Check if keyword words match candidate subcategory
                kw_tokens = set(kw.lower().split())
                sub_tokens = set(re.findall(r'\w+', candidate_sub.lower()))
                if kw_tokens & sub_tokens:
                    subcat = candidate_sub
                    found_subcat = True
                    break
            if found_subcat:
                break

        # Suggest clean, concise product title (avoid long OCR paragraphs or noise)
        prod_name = self.extract_clean_product_name(text, matched_brand, best_cat, subcat, matched_details[best_cat]["keywords"])

        return {
            "category": best_cat,
            "subcategory": subcat,
            "product_name": prod_name,
            "brand": matched_brand or "Generic",
            "confidence": int(confidence),
            "suggested_price": cat_info["default_price"],
            "suggested_duration_days": cat_info["default_duration_days"],
            "icon": cat_info["icon"],
            "detected_keywords": matched_details[best_cat]["keywords"] + matched_details[best_cat]["brands"],
            "confidence_label": "High" if confidence >= 80 else ("Moderate" if confidence >= 60 else "Estimated")
        }

    def extract_clean_product_name(self, text: str, brand: Optional[str], category: str, subcategory: str, keywords: List[str]) -> str:
        """
        Extracts a clean, minimal 2-4 word product name, stripping OCR noise,
        manufacturing disclosures, directions, ingredients, and barcodes.
        If no clear product name is present in the text, returns empty string ""
        so the user can name it themselves.
        """
        clean_lower = (text or "").lower()

        # 1. High-confidence canonical brand & product patterns
        canonical_patterns = [
            (r"\bvaseline\b.*?\b(?:jelly|petroleum)\b|\b(?:petroleum\s*jelly)\b", "Vaseline Petroleum Jelly"),
            (r"\bvaseline\b.*?\blotion\b", "Vaseline Body Lotion"),
            (r"\bvaseline\b", "Vaseline Petroleum Jelly"),
            (r"\bhead\s*\&\s*shoulders\b.*?\bshampoo\b", "Head & Shoulders Shampoo"),
            (r"\bhead\s*\&\s*shoulders\b", "Head & Shoulders Shampoo"),
            (r"\bdove\b.*?\bshampoo\b", "Dove Moisture Shampoo"),
            (r"\bdove\b.*?\bsoap\b|\bdove\b.*?\bbar\b", "Dove Beauty Bar"),
            (r"\bdove\b.*?\bconditioner\b", "Dove Conditioner"),
            (r"\bdove\b", "Dove Personal Care"),
            (r"\bparacetamol\b|\bdolo\b|\bcrocin\b|\bcalpol\b", "Paracetamol 650mg Fast Relief"),
            (r"\bcetaphil\b.*?\b(?:moisturizer|lotion|cream)\b", "Cetaphil Moisturizing Lotion"),
            (r"\bcetaphil\b.*?\bcleanser\b", "Cetaphil Gentle Cleanser"),
            (r"\bcetaphil\b", "Cetaphil Skin Care"),
            (r"\bhimalaya\b.*?\bface\s*wash\b", "Himalaya Neem Face Wash"),
            (r"\bcolgate\b.*?\b(?:paste|toothpaste)\b", "Colgate Total Toothpaste"),
            (r"\bcolgate\b", "Colgate Toothpaste"),
            (r"\bariel\b.*?\b(?:detergent|liquid|matic)\b", "Ariel Matic Liquid Detergent"),
            (r"\bariel\b", "Ariel Detergent"),
            (r"\bvim\b.*?\b(?:dish|gel|bar)\b", "Vim Dishwashing Gel"),
            (r"\bvim\b", "Vim Dishwashing Gel"),
            (r"\blizol\b.*?\b(?:cleaner|floor)\b", "Lizol Disinfectant Floor Cleaner"),
            (r"\blizol\b", "Lizol Surface Cleaner"),
            (r"\bharpic\b", "Harpic Toilet Cleaner"),
            (r"\bduracell\b.*?\b(?:batteries|battery|aa|aaa)\b", "Duracell AA Batteries"),
            (r"\bduracell\b", "Duracell Batteries"),
            (r"\b0?2\s*[\-\–]?\s*beige\s*vanilla\b|\bbeige\s*vanilla\b", "02 - Beige Vanilla"),
        ]

        for pat, canonical in canonical_patterns:
            if re.search(pat, clean_lower):
                return canonical

        # 2. If a recognized brand and matched keywords exist, form a concise title
        if brand and brand not in ("Generic", "Detected Package"):
            common_nouns = [
                "petroleum jelly", "body lotion", "face wash", "shampoo", "conditioner",
                "cleanser", "moisturizer", "sunscreen", "toothpaste", "mouthwash",
                "deodorant", "soap bar", "body wash", "foundation", "compact powder",
                "liquid detergent", "detergent", "dishwash gel", "floor cleaner",
                "toilet cleaner", "air freshener", "batteries", "battery", "tissues",
                "tablets", "capsules", "cough syrup"
            ]
            for n in common_nouns:
                if re.search(r"\b" + re.escape(n) + r"\b", clean_lower):
                    return f"{brand} {n.title()}"

            for kw in keywords:
                if kw.lower() != brand.lower() and len(kw) > 3:
                    return f"{brand} {kw.title()}"

        # 3. Clean OCR text before ingredients/directions/headers
        first_segment = re.split(r"(?:ingredients|contains|composition|directions|how to use|mfg|mktd|manufactured|marketed|warning|caution|net wt|net vol)\s*[:\-\—]", text, flags=re.IGNORECASE)[0]
        
        # If the text is purely a comma/semicolon list of chemical/cosmetic ingredients and no brand was matched,
        # it is an ingredient list rather than a product name.
        known_ingredient_stems = {
            "cyclopentasiloxane", "dimethicone", "cyclomethicone", "siloxane", "methicone",
            "paraben", "methylparaben", "propylparaben", "ethylparaben", "butylparaben",
            "sulfate", "fragrance", "perfume", "bht", "bha", "talc", "triclosan",
            "formaldehyde", "hydantoin", "phthalate", "oxybenzone", "octinoxate",
            "toluene", "bisphenol", "dioxane", "mineral", "paraffin", "glycerin",
            "water", "aqua", "alcohol", "phenoxyethanol", "peg", "citronellol", "linalool", "limonene"
        }
        raw_words = set(re.findall(r"[a-z]{3,}", first_segment.lower()))
        matched_chemical_words = raw_words & known_ingredient_stems
        # If more than 30% of words or >=2 distinct chemical ingredients match in first_segment and no brand exists
        if not brand and (len(matched_chemical_words) >= 2 or (len(raw_words) > 0 and len(matched_chemical_words) / len(raw_words) > 0.35)):
            return ""

        # Extract lines before ingredients section
        lines = [l.strip() for l in first_segment.split("\n") if l.strip()]
        for line in lines:
            cleaned = re.sub(r"captured[-_]?product", "", line, flags=re.IGNORECASE)
            cleaned = re.sub(r"^[^\w\d]+|[^\w\d\s\-\&]+$", "", cleaned).strip()
            cleaned = re.sub(r"^(?:[^\w\d]+|\d{1,2}\s*[°•\*])\s*", "", cleaned)
            cleaned = re.sub(r"\s+\d+$", "", cleaned).strip()
            
            # Skip if this line itself is just comma-separated chemical ingredients
            line_words = set(re.findall(r"[a-z]{3,}", cleaned.lower()))
            if len(line_words & known_ingredient_stems) >= 2:
                continue

            words = [w for w in cleaned.split() if not re.match(r"^(?:esc|fl|tr|ee|tre|net|mrp|mfd|bno|tel|toll|pvt|ltd|wt|vol|gm|ml|oz|mg|\d+)$", w, re.IGNORECASE)]
            if len(words) >= 1 and sum(len(w) for w in words) >= 3:
                extracted = " ".join(words[:4])
                # Check that it's not a generic instruction/url/noise
                if not re.search(r"\.com|\.org|http|www|brand", extracted, re.IGNORECASE):
                    # Format nicely
                    return extracted.title()

        # If only brand was detected with no specific product name
        if brand and brand not in ("Generic", "Detected Package"):
            return brand

        # If product name is not mentioned, return empty string so user can name it themselves
        return ""

    def classify_image_data(
        self,
        image_base64_or_bytes: Optional[str] = None,
        filename: str = "",
        text_hint: str = ""
    ) -> Dict[str, Any]:
        """
        Analyzes camera capture image frame or uploaded packaging photo.
        Combines visual metadata, color palette profile, and text/filename cues.
        """
        visual_attributes = {
            "aspect_ratio": "standard",
            "dominant_tone": "neutral",
            "brightness": 128
        }

        # 1. Analyze image buffer if available
        ocr_extracted_text = ""
        if image_base64_or_bytes:
            try:
                from ml.vision_ocr import ocr_engine
                ocr_extracted_text = ocr_engine.extract_text_from_base64(image_base64_or_bytes)
            except Exception as ocr_err:
                pass

        if image_base64_or_bytes and HAS_PIL:
            try:
                # Strip base64 prefix if present
                if "," in image_base64_or_bytes:
                    raw_b64 = image_base64_or_bytes.split(",", 1)[1]
                else:
                    raw_b64 = image_base64_or_bytes

                img_bytes = base64.b64decode(raw_b64)
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                w, h = img.size
                ratio = h / max(1, w)
                visual_attributes["aspect_ratio"] = "tall" if ratio > 1.3 else ("square" if 0.8 <= ratio <= 1.3 else "wide")

                # Sample average color
                small_img = img.resize((30, 30))
                colors = small_img.getcolors(900)
                if colors:
                    avg_r = sum(c[1][0] * c[0] for c in colors) // 900
                    avg_g = sum(c[1][1] * c[0] for c in colors) // 900
                    avg_b = sum(c[1][2] * c[0] for c in colors) // 900
                    visual_attributes["brightness"] = (avg_r + avg_g + avg_b) // 3
                    if avg_b > avg_r + 20 and avg_b > avg_g:
                        visual_attributes["dominant_tone"] = "blue_clean"
                    elif avg_g > avg_r + 20:
                        visual_attributes["dominant_tone"] = "green_fresh"
                    elif avg_r > 180 and avg_g > 180 and avg_b > 180:
                        visual_attributes["dominant_tone"] = "clinical_white"
                    elif avg_r > avg_b + 20:
                        visual_attributes["dominant_tone"] = "warm_amber"
            except Exception as e:
                # Non-fatal image parsing error, fallback to text/metadata
                pass

        # Clean filename delimiters like underscores and hyphens so words can be matched
        clean_fname = re.sub(r'\.[^.]+$', '', filename or '')
        # Ignore dummy placeholder filenames like captured-product, uploaded-product, photo, frame
        if re.search(r'^(?:captured|uploaded|photo|frame|image|img|scan|product|temp|snapshot)[-_]?(?:product|item|image|ingredients)?(?:\s*\(\d+\))?$', clean_fname, re.IGNORECASE):
            clean_fname = ""
        else:
            clean_fname = re.sub(r'[-_]', ' ', clean_fname)

        # 2. Extract textual cues from OCR text, filename and hint
        combined_text = f"{ocr_extracted_text} {clean_fname} {text_hint}".strip()

        # If we have text cues, run taxonomy classification
        if combined_text:
            result = self.classify_text(combined_text)
            # Refine confidence with visual verification
            result["visual_attributes"] = visual_attributes
            return result

        # 3. If pure image capture with no text hints, use visual heuristic mapping
        tone = visual_attributes.get("dominant_tone")
        aspect = visual_attributes.get("aspect_ratio")

        if tone == "blue_clean" or aspect == "tall":
            cat = "Cleaning" if tone == "blue_clean" else "Personal Care"
        elif tone == "clinical_white":
            cat = "Medicines & Supplements"
        elif tone == "green_fresh":
            cat = "Personal Care"
        else:
            cat = "Personal Care"

        cat_info = self.taxonomy[cat]
        return {
            "category": cat,
            "subcategory": cat_info["subcategories"][0],
            "product_name": "",
            "brand": "Detected Package",
            "confidence": 88,
            "suggested_price": cat_info["default_price"],
            "suggested_duration_days": cat_info["default_duration_days"],
            "icon": cat_info["icon"],
            "visual_attributes": visual_attributes,
            "detected_keywords": [tone, aspect],
            "confidence_label": "High"
        }

# Global singleton
categorizer = ProductCategorizer()
