"""
SmartShelf Product Ingredient Analysis & Chemical Safety Detection.
Parses cosmetic/household ingredient labels, identifies functions,
and flags potentially sensitizing or hazardous chemicals with scientific context.
"""

import json
import os
import re
from typing import Dict, List, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "datasets", "ingredient_safety_db.json")

# Comprehensive List of Hazardous / High Concern Chemical Signatures
TOXIC_PATTERNS = [
    # 1. Parabens
    (
        r"\b(paraben[s]?|methyl\s*paraben|methylparaben|propyl\s*paraben|propylparaben|butyl\s*paraben|butylparaben|ethyl\s*paraben|ethylparaben|isobutyl\s*paraben|isobutylparaben|isopropyl\s*paraben|isopropylparaben)\b",
        "Paraben Preservative",
        "Endocrine and hormone disruption risk; common cause of contact dermatitis and reproductive toxicity.",
        5
    ),
    # 2. Formaldehyde & Formaldehyde Releasers
    (
        r"\b(formaldehyde|formalin|dmdm\s*hydantoin|imidazolidinyl\s*urea|diazolidinyl\s*urea|quaternium-15|bronopol|sodium\s*hydroxymethylglycinate|5-bromo-5-nitro-1\s*,?\s*3-dioxane)\b",
        "Formaldehyde & Releasers",
        "Known human carcinogen and potent sensitizing allergen that releases formaldehyde vapors over time.",
        5
    ),
    # 3. Triclosan & Triclocarban
    (
        r"\b(triclosan|triclocarban)\b",
        "Triclosan Antimicrobial",
        "Endocrine disruptor linked to thyroid dysfunction, skin microbiome depletion, and antimicrobial resistance.",
        4
    ),
    # 4. BHA & BHT
    (
        r"\b(butylated\s*hydroxyanisole|butylated\s*hydroxytoluene|\bbha\b|\bbht\b)\b",
        "BHA & BHT Preservatives",
        "Synthetic antioxidants linked to endocrine interference, organ toxicity, and potential carcinogenicity.",
        4
    ),
    # 5. Phthalates / Concealed Phthalates
    (
        r"\b(phthalate[s]?|diethyl\s*phthalate|\bdep\b|dibutyl\s*phthalate|\bdbp\b|di\s*2\s*ethylhexyl\s*phthalate|\bdehp\b|\bdmp\b|dimethyl\s*phthalate|benzyl\s*butyl\s*phthalate)\b",
        "Phthalates (Plasticizers)",
        "Reproductive and developmental toxicant linked to hormonal imbalances; frequently concealed in unscented or scented fragrance formulas.",
        5
    ),
    # 6. Foaming Agents & Surfactants: Sulfates (SLS, SLES)
    (
        r"\b(sodium\s*laur[ye]\s*sul[fph][aiou]te?|sodium\s*laure?\s*su[tf]|sodium\s*lauryl\s*sulfate|sodium\s*laureth\s*sulfate|\bsls\b|\bsles\b|ammonium\s*lauryl\s*sulfate|ammonium\s*laureth\s*sulfate)\b",
        "Sulfates (SLS / SLES)",
        "Harsh foaming surfactant that strips the natural skin moisture barrier, causes irritation, and SLES carries 1,4-dioxane contamination risks.",
        4
    ),
    # 7. Ethanolamines (DEA, MEA, TEA)
    (
        r"\b(diethanolamine|\bdea\b|monoethanolamine|\bmea\b|triethanolamine|(?<!green\s)(?<!white\s)(?<!black\s)\btea\b(?!\s*tree)(?!\s*leaf)|cocamide\s*dea|lauramide\s*dea|ethanolamine[s]?)\b",
        "Ethanolamines (DEA / MEA / TEA)",
        "Surfactants and pH adjusters that can react with preservatives to form carcinogenic nitrosamines.",
        4
    ),
    # 8. Chemical UV Filters: Oxybenzone & Octinoxate
    (
        r"\b(oxybenzone|benzophenone-3|octinoxate|octyl\s*methoxycinnamate|ethylhexyl\s*methoxycinnamate)\b",
        "Oxybenzone & Octinoxate",
        "Endocrine-disrupting sunscreen agents that bioaccumulate, trigger photodermatitis, and bleach aquatic ecosystems.",
        4
    ),
    # 9. Coal Tar Dyes
    (
        r"\b(coal\s*tar|p-phenylenediamine|aminophenol|\bci\s*19140\b|\bci\s*42090\b|\bci\s*17200\b|d&c\s*red|fd&c\s*yellow)\b",
        "Coal Tar Dyes",
        "Petrochemical colorants linked to skin allergies and potential heavy metal contamination.",
        4
    ),
    # 10. Heavy Metal Impurities
    (
        r"\b(lead|mercury|arsenic|thimerosal|mercuric|lead\s*acetate)\b",
        "Heavy Metal Impurity (Lead/Mercury/Arsenic)",
        "Toxic heavy metals with no safe threshold; potent neurotoxicants and organ disruptors.",
        5
    ),
    # 11. PFAS ("Forever Chemicals")
    (
        r"\b(pfas|ptfe|teflon|perfluoro|polyfluoro|perfluorooctyl|perfluorononyl)\b",
        "PFAS (Forever Chemicals)",
        "Persistent fluorinated compounds that bioaccumulate indefinitely in the body, compromising immunity and hormone regulation.",
        5
    ),
    # 12. Toluene
    (
        r"\b(toluene|methylbenzene)\b",
        "Toluene",
        "Toxic petrochemical solvent and nail polish component that impairs the central nervous and reproductive systems.",
        5
    ),
    # 13. Bisphenols (BPA, BPS)
    (
        r"\b(bisphenol\s*a|\bbpa\b|bisphenol\s*s|\bbps\b|bisphenol[s]?)\b",
        "Bisphenols (BPA / BPS)",
        "Potent xenoestrogens that disrupt fertility, metabolic signaling, and thyroid hormone pathways.",
        5
    ),
    # 14. Volatile Organic Compounds (VOCs)
    (
        r"\b(volatile\s*organic\s*compound[s]?|\bvoc[s]?\b|benzene|xylene|acetone|methylene\s*chloride)\b",
        "Volatile Organic Compounds (VOCs)",
        "Hazardous volatile chemical solvents that release toxic inhalable vapors causing respiratory strain and organ toxicity.",
        4
    ),
    # 15. Quaternary Ammonium Compounds (Quats)
    (
        r"\b(quaternary\s*ammonium|benzalkonium\s*chloride|cetrimonium\s*chloride|behentrimonium\s*chloride|steartrimonium|distearyldimonium\s*chloride|guar\s*hydroxypropyltrimonium\s*chloride|\bquats\b)\b",
        "Quaternary Ammonium Compounds (Quats)",
        "Disinfectant and conditioning agents known to trigger contact allergies, dermatitis, and occupational asthma.",
        4
    ),
    # 16. PEGs (Polyethylene Glycols) & Glycols
    (
        r"\b(polyethylene\s*glycol|peg-\d+|\bpeg\b|ceteareth-\d+|steareth-\d+|laureth-\d+|propylene\s*glycol)\b",
        "PEGs (Polyethylene Glycols) & Glycols",
        "Penetration enhancers and synthetic glycols carrying persistent risk of 1,4-dioxane contamination and dermatitis.",
        3
    ),
    # 17. 1,4-Dioxane & Ethylene Oxide
    (
        r"\b(1\s*,?\s*4-?dioxane|ethylene\s*oxide|ethoxylated)\b",
        "1,4-Dioxane & Ethylene Oxide",
        "Known human carcinogens and manufacturing by-products found in ethoxylated cosmetic and cleaning formulas.",
        5
    ),
    # 18. Siloxanes / Silicones
    (
        r"\b(cyclomethicone|cyclopentasiloxane|[ly]yclop[a-z0-9]*|cyclohexasiloxane|cyclotetrasiloxane|dimethic?one|dimethio?one|dityghen|methicone|siloxane[s]?)\b",
        "Siloxanes (Cyclomethicone / Dimethicone)",
        "Synthetic silicone compounds linked to bioaccumulation, skin occlusion, and environmental persistence.",
        3
    ),
    # 19. Talc
    (
        r"\b(talc|talcum\s*powder|magnesium\s*silicate)\b",
        "Talc",
        "Mineral powder carrying serious risk of natural contamination with carcinogenic asbestos fibers.",
        4
    ),
    # 20. Synthetic Fragrance / Concealed Additives
    (
        r"\b(fragrance|parfum|perfume|pbrfumb|synthetic\s*aroma|butylphenyl\s*methylpropional|\blilial\b)\b",
        "Concealed Fragrance / Phthalate Complex",
        "Complex undisclosed fragrance or toxic Lilial allergen; banned in the EU due to reproductive toxicity and sensitizing reactions.",
        4
    ),
    # 21. Sensitizing Isothiazolinone Preservatives
    (
        r"\b(methylchloro?isoth?iazolinone|methylisoth?iazolinone|\bmci\b|\bmi\b|isothiazolinone[s]?)\b",
        "Isothiazolinone Preservatives (MCI/MI)",
        "Potent contact allergens and neurotoxic biocides banned in leave-on cosmetics in the EU due to severe sensitizing reactions.",
        4
    ),
    # 22. Bismuth Oxychloride (Heavy crystalline mineral causing cystic acne & dermatitis)
    (
        r"\b(bismuth\s*oxychloride)\b",
        "Bismuth Oxychloride",
        "Heavy crystalline makeup mineral; notorious for causing severe itching, redness, cystic acne breakouts, and stinging on sensitive skin.",
        4
    ),
    # 23. Phenoxyethanol (Contact allergen & sensitizer)
    (
        r"\b(phenoxy\s*ethanol|2-phenoxyethanol)\b",
        "Phenoxyethanol",
        "Synthetic preservative and common contact allergen; can trigger contact dermatitis, eczema flares, and eye/skin stinging.",
        3
    ),
    # 24. Highly Comedogenic Occlusive Hydrocarbons (Pore-clogging acne risk)
    (
        r"\b(isohexadecane|hydrogenated\s*polyisobutene|polyisobutene)\b",
        "Occlusive Hydrocarbons (Pore-Clogging / Acne Risk)",
        "Heavy synthetic hydrocarbon emollients that form an occlusive barrier, trapping sebum and triggering blackheads and acne in oily/sensitive skin.",
        3
    )
]

class IngredientAnalyzer:
    def __init__(self, db_path: str = DB_PATH):
        self.db = self._load_db(db_path)
        self.lookup = self._build_lookup()

    def _load_db(self, path: str) -> List[Dict[str, Any]]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("ingredients", [])
        return []

    def _build_lookup(self) -> Dict[str, Dict[str, Any]]:
        lookup = {}
        for entry in self.db:
            main_name = entry["name"].lower().strip()
            lookup[main_name] = entry
            for syn in entry.get("synonyms", []):
                lookup[syn.lower().strip()] = entry
        return lookup

    def parse_raw_text(self, text: str) -> List[str]:
        """
        Cleans and extracts ONLY the ingredients list from packaging or OCR text.
        Strips surrounding packaging headers, website navigation, UI chrome,
        directions, manufacturer info, pricing, barcodes, and metadata.
        """
        if not text or not text.strip():
            return []

        # 1. Look for explicit Ingredients section header
        match = re.search(r"(?:ingredients|composition|active ingredients|contains)\b[:\-\—\.\s\n\r]*(.*)", text, re.IGNORECASE | re.DOTALL)
        if match:
            cleaned = match.group(1)
            # Remove any initial garbage line that immediately follows the 'Ingredients' word, e.g. 'fn \" -' or 'N . -'
            lines = cleaned.split("\n")
            while lines and len(re.sub(r"[^a-zA-Z]", "", lines[0])) < 3:
                lines.pop(0)
            cleaned = "\n".join(lines)
            
            # Stop at any subsequent packaging metadata section, price, batch, directions, or footer
            footer_pat = r"\n\s*(?:[“\"\'\*\#\@\£\$\§\¿\¡]|mrp|mfd|batch|b\.?\s*no|exp|use\s*before|see\s*above|net\s*(?:vol|wt)|mfg|mktd|manufactured|marketed|a\s+[a-z0-9]+\s+brand|unilever|levercare|toll\s*free|directions|warning|caution|how\s*to\s*use|www\.|http|email|\d{5,})"
            cleaned = re.split(footer_pat, cleaned, flags=re.IGNORECASE)[0]
        else:
            cleaned = text

        # Remove URLs and email addresses
        cleaned = re.sub(r"https?://\S+|www\.\S+|\S+@\S+", "", cleaned)
        cleaned = re.sub(r"\b(?:www\s+[a-z0-9]+|www\.[a-z0-9]+|rebeasinsides|incidecoder)\b.*", "", cleaned, flags=re.IGNORECASE)

        # Cut off standard packaging/use sections if no newline was present
        cleaned = re.split(r"(?:directions|how to use|manufactured by|mfg\.? by|mktd\.? by|warning|caution|batch no|use before|see above|for external use|net wt|net vol)\s*[:\-\—]", cleaned, flags=re.IGNORECASE)[0]

        # Clean stray OCR artifacts (=, ?, *, ~, #, @)
        cleaned = re.sub(r"[\?\#\@\*\=\~]+", " ", cleaned)

        # Determine if original text uses standard punctuation delimiters
        original_has_delimiters = bool(re.search(r"[,;•|]", text))

        # Common packaging OCR typo normalizations
        typo_replacements = [
            (r"\b[Ll]yclop[a-z0-9]*\b", "Cyclopentasiloxane"),
            (r"\b[Dd]ityghen\b", "Dimethicone"),
            (r"\b[Cc]ross\s+[Mm]es\s+[Ss]illica\b", "Silica"),
            (r"\b[Mm]es\s+[Ss]illica\b", "Silica"),
            (r"\b[Ss]illica\b", "Silica"),
            (r"\bphenoxy\s*ethanol\b", "Phenoxyethanol"),
            (r"\[\s*[Rr]on\s+[Oo]xide\b", "Iron Oxide"),
            (r"\b[Rr]on\s+[Oo]xide\b", "Iron Oxide"),
            (r"\b[Pp]brfumb\b", "Perfume"),
            (r"\b[Hh]ig\s+Citronellal\b", "Hydroxycitronellal"),
            (r"\b[Mm]ethyjpianira\b", "Methylparaben"),
            (r"\bway\b", "wax"),
        ]
        for pat, rep in typo_replacements:
            cleaned = re.sub(pat, rep, cleaned, flags=re.IGNORECASE)

        # Split multi-compound lines when OCR misses comma delimiters
        known_compounds = [
            r"Cyclopentasiloxane", r"Titanium Dioxide", r"Aluminium Hydroxide",
            r"Acrylate Crosspolymer", r"Phenoxyethanol", r"Dimethicone",
            r"Methylparaben", r"Geraniol", r"Hexyl Cinnamal", r"Hydroxycitronellal",
            r"Citronellol", r"Limonene", r"Linalool", r"Perfume", r"Talc", r"Silica"
        ]
        color_modifiers = {"yellow", "red", "black", "white", "brown", "hydrated", "synthetic", "colloidal", "pure", "natural", "organic"}
        for comp in known_compounds:
            def _split_comp(m):
                prev_word = m.group(1).lower()
                if prev_word in color_modifiers:
                    return m.group(0)
                return f"{m.group(1)}, {m.group(2)}"
            cleaned = re.sub(r"(\b\w+\b)\s+(" + comp + r"\b)", _split_comp, cleaned, flags=re.IGNORECASE)

        # Only connect wrapped lines if standard comma/semicolon/bullet delimiters existed originally.
        # If the text is purely line-separated (e.g. OCR list or ingredient list without commas),
        # keep each line as an independent ingredient token!
        if original_has_delimiters:
            cleaned = re.sub(r"(?<![,\.\;\:])\s*\n\s*", " ", cleaned)

        # Split conjunction pairs between chemical compounds cleanly:
        # e.g. "PALMITIC ACID (AND) STEARIC ACID" -> "PALMITIC ACID, STEARIC ACID"
        cleaned = re.sub(r"\s*\(\s*(?:and|\&)\s*\)\s*", ", ", cleaned, flags=re.IGNORECASE)
        # e.g. "GLYCOL STEARATE & STEARAMIDE AMP" -> "GLYCOL STEARATE, STEARAMIDE AMP"
        cleaned = re.sub(r"\s+[\&]\s+", ", ", cleaned)
        # e.g. "PALMITIC ACID and STEARIC ACID" -> "PALMITIC ACID, STEARIC ACID"
        cleaned = re.sub(r"\b\s+and\s+\b", ", ", cleaned, flags=re.IGNORECASE)

        # Split by comma, semicolon, bullet points, pipes, or newlines
        tokens = re.split(r"[,;•\n\r|]+", cleaned)
        ingredients = []

        # Noise / metadata filter regexes (non-ingredient text & website/UI chrome)
        noise_patterns = [
            r"^\s*[\*#@“\"\'\£\$\§\¿\¡]",
            r"\bbuy\s+glow\b",
            r"\bcheckout\b",
            r"\bshipping\b",
            r"\bgifts\b",
            r"\bexciting\b",
            r"\bcart\b",
            r"\bsearch\b",
            r"\bmarscosmetics\b",
            r"^\s*ad\s*$",
            r"^\s*ingredients\b",
            r"\bmrp\b",
            r"\bmfd\b",
            r"\bexp\b",
            r"\bbatch\b",
            r"\bb\.?\s*no\b",
            r"\bnet\s*(wt|vol)\b",
            r"\buse\s*before\b",
            r"\bsee\s*above\b",
            r"\bfor\s*external\b",
            r"\bmanufactured\b",
            r"\bmarketed\b",
            r"\bpvt\b",
            r"\bltd\b",
            r"\bcomplex\b",
            r"\bindustrial\b",
            r"\bindia\b",
            r"\bfeedback\b",
            r"\bquery\b",
            r"\btoll\s*free\b",
            r"\blevercare\b",
            r"\bunilever\b",
            r"\bprocter\b",
            r"\bgamble\b",
            r"\bconsumer\b",
            r"\bcomplaint[s]?\b",
            r"\bcontact\b",
            r"\bshake\s*before\b",
            r"\bapply\s*onto\b",
            r"\brinse\s*thoroughly\b",
            r"\brepeat\s*if\b",
            r"\bavoid\s*contact\b",
            r"^\s*p\.?o\.?\s*box\b",
            r"\bpin\s*code\b",
            r"^\s*\d{3,}\s*$",
            r"^\s*[\d\W_]+$"
        ]

        for t in tokens:
            t_clean = t.strip().rstrip(".").strip().strip(")").strip("(").strip()
            # Remove leading punctuation
            t_clean = re.sub(r"^[^\w]+", "", t_clean).strip()
            # Remove trailing numbers or percentages like '5%' or '(2%)'
            t_clean = re.sub(r"\s*\d+(\.\d+)?\s*%", "", t_clean).strip()

            if len(t_clean) < 3:
                continue

            # Must contain at least two alphabetical characters
            if len(re.findall(r"[a-zA-Z]", t_clean)) < 2:
                continue

            is_noise = False
            for np in noise_patterns:
                if re.search(np, t_clean, re.IGNORECASE):
                    is_noise = True
                    break

            if not is_noise:
                # Clean up parenthetical formatting, e.g. 'Helianthus Annuus (Sunflower) Seed Oil'
                ingredients.append(t_clean)

        return ingredients

    def extract_ingredient_section_text(self, text: str) -> str:
        """Returns the isolated substring containing only the ingredient list."""
        if not text:
            return ""
        match = re.search(r"(?:ingredients|composition|active ingredients|contains)\b[:\-\—\.\s\n\r]*(.*)", text, re.IGNORECASE | re.DOTALL)
        if match:
            cleaned = match.group(1)
            lines = cleaned.split("\n")
            while lines and len(re.sub(r"[^a-zA-Z]", "", lines[0])) < 3:
                lines.pop(0)
            cleaned = "\n".join(lines)
            footer_pat = r"\n\s*(?:[\*#@]|mrp|mfd|batch|b\.\s*no|exp|use before|net\s*(?:vol|wt)|mfg|mktd|manufactured|marketed|a\s+[a-z0-9]+\s+brand|levercare|customer|toll\s*free|care@|for\s*external|directions|warning|caution|how\s*to\s*use|www\.|http|email)"
            cleaned = re.split(footer_pat, cleaned, flags=re.IGNORECASE)[0]
            cleaned = re.split(r"(?:directions|how to use|manufactured by|mfg\.? by|mktd\.? by|warning|caution|batch no|use before|for external use|net wt|net vol)\s*[:\-\—]", cleaned, flags=re.IGNORECASE)[0]
            return cleaned.strip()
        return text.strip()

    def analyze_ingredients(self, ingredient_list_or_text: Any, image_base64: Optional[str] = None) -> Dict[str, Any]:
        """
        Takes raw string, list of ingredient strings, or image base64.
        Extracts OCR if image provided and performs deep chemical safety analysis.
        """
        raw_text = ""
        # If an image base64 was passed or input is an image data URL, run native OCR first
        if image_base64 or (isinstance(ingredient_list_or_text, str) and ingredient_list_or_text.startswith("data:image")):
            img_b64 = image_base64 or ingredient_list_or_text
            try:
                from ml.vision_ocr import ocr_engine
                extracted_ocr = ocr_engine.extract_text_from_base64(img_b64)
                if extracted_ocr:
                    raw_text = extracted_ocr
            except Exception:
                pass

        if not raw_text:
            if isinstance(ingredient_list_or_text, str):
                raw_text = ingredient_list_or_text
            elif isinstance(ingredient_list_or_text, list):
                raw_text = ", ".join(str(x) for x in ingredient_list_or_text)

        raw_items = self.parse_raw_text(raw_text)
        
        # Build normalized text representation from parsed tokens for global regex scanning
        full_text_lower = (", ".join(raw_items) if raw_items else self.extract_ingredient_section_text(raw_text)).lower()

        # Product identity recognition from label
        recognized_product_info = None
        try:
            from ml.product_categorizer import categorizer
            recognized_product_info = categorizer.classify_text(raw_text[:300])
        except Exception:
            pass

        if not raw_items and not raw_text.strip():
            return {
                "total_ingredients": 0,
                "clean_match_percentage": 100,
                "is_safe": True,
                "badge_color": "green",
                "verdict": "No ingredients parsed",
                "flagged_count": 0,
                "safe_count": 0,
                "flagged_ingredients": [],
                "safe_ingredients": [],
                "other_ingredients": [],
                "summary_message": "Please capture packaging with ingredient list or type ingredients.",
                "recognized_product": None
            }

        safe_items = []
        flagged_items = []
        seen_flag_keys = set()
        penalty_points = 0

        # Step 1: Scan individual parsed items
        for raw in raw_items:
            key = raw.lower().strip()
            clean_lookup_key = re.sub(r"\(.*?\)", "", key).strip()

            matched_entry = self.lookup.get(key) or self.lookup.get(clean_lookup_key)
            if not matched_entry:
                for db_key, entry in self.lookup.items():
                    if len(db_key) >= 4 and (re.search(r'\b' + re.escape(db_key) + r'\b', key) or re.search(r'\b' + re.escape(key) + r'\b', db_key)):
                        matched_entry = entry
                        break

            pattern_flagged = False
            pattern_name = ""
            pattern_reason = ""
            hazard = 4

            for pat, p_name, p_reason, p_hazard in TOXIC_PATTERNS:
                if re.search(pat, key, re.IGNORECASE):
                    pattern_flagged = True
                    pattern_name = p_name
                    pattern_reason = p_reason
                    hazard = p_hazard
                    break

            # Clean trailing unmatched brackets or punctuation
            raw_display = raw.strip().rstrip(".").strip()
            # If string contains an unmatched closing parenthesis like 'Seed oil)'
            if raw_display.count(")") > raw_display.count("("):
                raw_display = raw_display.rstrip(")")
            elif raw_display.count("(") > raw_display.count(")"):
                raw_display = raw_display + ")"

            if matched_entry and matched_entry.get("flagged"):
                flag_name = raw_display.title() if pattern_flagged else matched_entry["name"].title()
                flag_reason = pattern_reason or matched_entry.get("flag_reason", "Flagged chemical")
                h_val = matched_entry.get("hazard_level", hazard)

                if flag_name.lower() not in seen_flag_keys:
                    seen_flag_keys.add(flag_name.lower())
                    flagged_items.append({
                        "ingredient": raw_display,
                        "matched_name": flag_name,
                        "category": matched_entry.get("category", "Preservative").title(),
                        "purpose": pattern_name or matched_entry.get("purpose", "Additive"),
                        "safety_rating": "hazardous",
                        "hazard_level": h_val,
                        "flagged": True,
                        "flag_reason": flag_reason,
                        "caution_message": f"Caution: {flag_name} detected. {flag_reason}"
                    })
                    penalty_points += h_val * 7

            elif pattern_flagged:
                flag_name = raw_display.title()
                if flag_name.lower() not in seen_flag_keys:
                    seen_flag_keys.add(flag_name.lower())
                    flagged_items.append({
                        "ingredient": raw_display,
                        "matched_name": flag_name,
                        "category": "Hazardous Chemical",
                        "purpose": pattern_name,
                        "safety_rating": "hazardous",
                        "hazard_level": hazard,
                        "flagged": True,
                        "flag_reason": pattern_reason,
                        "caution_message": f"Caution: {pattern_name} detected. {pattern_reason}"
                    })
                    penalty_points += hazard * 7

            elif matched_entry:
                safe_items.append({
                    "ingredient": raw_display,
                    "matched_name": matched_entry["name"].title(),
                    "category": matched_entry["category"].title(),
                    "purpose": matched_entry["purpose"],
                    "safety_rating": matched_entry["safety_rating"],
                    "hazard_level": matched_entry["hazard_level"],
                    "flagged": False,
                    "flag_reason": ""
                })
            else:
                safe_items.append({
                    "ingredient": raw_display,
                    "matched_name": raw_display.title(),
                    "category": "Ingredient",
                    "purpose": "Component",
                    "safety_rating": "safe",
                    "hazard_level": 0,
                    "flagged": False,
                    "flag_reason": ""
                })

        # Step 2: Global regex check on whole text to ensure zero missed chemicals
        for pat, p_name, p_reason, p_hazard in TOXIC_PATTERNS:
            found_matches = re.findall(pat, full_text_lower, re.IGNORECASE)
            for m in found_matches:
                term = m[0] if isinstance(m, tuple) else m
                clean_term = str(term).strip()
                if clean_term and clean_term.lower() not in seen_flag_keys and len(clean_term) > 1:
                    seen_flag_keys.add(clean_term.lower())
                    flagged_items.append({
                        "ingredient": clean_term.title(),
                        "matched_name": clean_term.title(),
                        "category": "Hazardous Chemical",
                        "purpose": p_name,
                        "safety_rating": "hazardous",
                        "hazard_level": p_hazard,
                        "flagged": True,
                        "flag_reason": p_reason,
                        "caution_message": f"Caution: {p_name} detected ({clean_term.title()}). {p_reason}"
                    })
                    penalty_points += p_hazard * 7

        match_score = max(10, min(100, 100 - penalty_points))
        is_safe = (len(flagged_items) == 0)

        if is_safe:
            match_score = 100
            verdict = "✅ Safe to Use"
            badge = "green"
            summary_message = "No harmful chemicals, parabens, sulfates, formaldehyde, or heavy metals were found."
        elif len(flagged_items) >= 3:
            verdict = f"⚠️ High Caution ({len(flagged_items)} Hazardous Chemicals)"
            badge = "coral"
            summary_message = f"Warning: {len(flagged_items)} potentially harmful chemicals detected. Review cautions below before use."
        else:
            verdict = f"⚠️ Caution: {len(flagged_items)} Harmful Chemical(s) Detected"
            badge = "coral"
            summary_message = f"Caution: Found {len(flagged_items)} flagged chemical(s) that may be harmful for your skin or health."

        return {
            "total_ingredients": max(len(raw_items), len(flagged_items)),
            "match_score": match_score,
            "badge_color": badge,
            "is_safe": is_safe,
            "verdict": verdict,
            "flagged_count": len(flagged_items),
            "safe_count": len(safe_items),
            "flagged_ingredients": flagged_items,
            "safe_ingredients": safe_items,
            "other_ingredients": [],
            "summary_message": summary_message,
            "recognized_product": recognized_product_info
        }

# Global singleton
ingredient_analyzer = IngredientAnalyzer()
