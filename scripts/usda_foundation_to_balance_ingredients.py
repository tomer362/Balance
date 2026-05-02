#!/usr/bin/env python3
"""Convert USDA FoodData Central Foundation Foods JSON into Balance ingredients.

Input: the public Foundation Foods JSON file from FoodData Central downloads.
Output: a Balance-compatible ingredient JSON array.

Example:
  python3 scripts/usda_foundation_to_balance_ingredients.py \
    /tmp/FoodData_Central_foundation_food_json_2026-04-30.json \
    src/data/usdaFoundationIngredients.json
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

NUTRIENTS = {
    "calories": [1008, 2047, 2048],
    "protein_g": [1003],
    "carbs_g": [1005, 1050],
    "fiber_g": [1079],
    "sugar_g": [1063, 2000],
    "fat_g": [1004],
    "saturated_fat_g": [1258],
    "sodium_mg": [1093],
}
OMEGA3_IDS = [1272, 1278, 1404, 1405, 1406, 1407, 1408]

CATEGORY_KEYWORDS = [
    ("protein", ["chicken", "beef", "turkey", "pork", "fish", "salmon", "tuna", "egg", "sardine", "shrimp"]),
    ("nut_seed", ["almond", "walnut", "peanut", "seed", "chia", "sesame"]),
    ("dairy", ["milk", "yogurt", "cheese", "cottage", "cream"]),
    ("grain", ["rice", "oat", "wheat", "pasta", "bread", "quinoa", "cereal", "flour"]),
    ("legume", ["bean", "lentil", "chickpea", "hummus", "pea", "soy"]),
    ("vegetable", ["spinach", "kale", "broccoli", "carrot", "tomato", "pepper", "lettuce", "potato"]),
    ("fruit", ["apple", "banana", "berry", "orange", "grape", "melon", "peach", "pear"]),
    ("fat_oil", ["oil", "butter", "margarine"]),
]


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:90] or "food"


def nutrient_map(food: dict[str, Any]) -> dict[int, float]:
    values: dict[int, float] = {}
    for item in food.get("foodNutrients", []):
        nutrient = item.get("nutrient") or {}
        nutrient_id = nutrient.get("id")
        amount = item.get("amount")
        if isinstance(nutrient_id, int) and isinstance(amount, (int, float)):
            values[nutrient_id] = float(amount)
    return values


def first_value(values: dict[int, float], ids: list[int]) -> float:
    for nutrient_id in ids:
        if nutrient_id in values:
            return values[nutrient_id]
    return 0.0


def category_for(name: str) -> str:
    lower = name.lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword in lower for keyword in keywords):
            return category
    return "condiment"


def tags_for(name: str, nutrition: dict[str, float], category: str) -> list[str]:
    tags = {"usda", "foundation-food", category.replace("_", "-")}
    lower = name.lower()
    if nutrition["protein_g"] >= 20:
        tags.add("high-protein")
    if nutrition["fiber_g"] >= 6:
        tags.add("high-fiber")
    if nutrition["calories"] >= 250:
        tags.add("calorie-dense")
    if nutrition.get("omega3_g", 0) >= 1:
        tags.add("omega-3")
    if any(word in lower for word in ["raw", "fresh"]):
        tags.add("fresh")
    return sorted(tags)


def score_pcos(nutrition: dict[str, float]) -> float:
    score = 6.0
    if nutrition["protein_g"] >= 15:
        score += 1.0
    if nutrition["fiber_g"] >= 5:
        score += 1.0
    if nutrition["sugar_g"] <= 5:
        score += 0.8
    if nutrition.get("omega3_g", 0) >= 1:
        score += 0.7
    if nutrition["saturated_fat_g"] > 8:
        score -= 1.0
    if nutrition["sodium_mg"] > 500:
        score -= 0.6
    return round(max(1.0, min(10.0, score)), 1)


def score_bulk(nutrition: dict[str, float]) -> float:
    score = 6.0
    if nutrition["protein_g"] >= 15:
        score += 1.2
    if nutrition["calories"] >= 180:
        score += 0.8
    if nutrition["carbs_g"] >= 25:
        score += 0.5
    if nutrition["sodium_mg"] > 700:
        score -= 0.5
    return round(max(1.0, min(10.0, score)), 1)


def convert_food(food: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(food, dict):
        return None
    name = str(food.get("description") or "").strip()
    fdc_id = food.get("fdcId")
    if not name or not fdc_id:
        return None

    values = nutrient_map(food)
    nutrition = {key: round(first_value(values, ids), 2) for key, ids in NUTRIENTS.items()}
    nutrition["omega3_g"] = round(sum(values.get(nutrient_id, 0.0) for nutrient_id in OMEGA3_IDS), 3)
    if nutrition["calories"] <= 0 and nutrition["protein_g"] <= 0 and nutrition["carbs_g"] <= 0 and nutrition["fat_g"] <= 0:
        return None

    category = category_for(name)
    return {
        "id": f"usda-{fdc_id}-{slugify(name)}",
        "name": name,
        "category": category,
        **nutrition,
        "pcos_score": score_pcos(nutrition),
        "bulk_score": score_bulk(nutrition),
        "common_serving_g": 100,
        "common_serving_label": "100 g",
        "tags": tags_for(name, nutrition, category),
        "source": "USDA FoodData Central Foundation Foods",
        "source_id": fdc_id,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="USDA Foundation Foods JSON file")
    parser.add_argument("output", type=Path, help="Output Balance ingredient JSON")
    args = parser.parse_args()

    data = json.loads(args.input.read_text(encoding="utf-8"))
    foods = data.get("FoundationFoods") if isinstance(data, dict) else data
    if not isinstance(foods, list):
        raise ValueError("Expected a USDA FoundationFoods array")

    converted = [item for item in (convert_food(food) for food in foods) if item]
    converted.sort(key=lambda item: item["name"].lower())

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(converted, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(converted)} ingredients to {args.output}")


if __name__ == "__main__":
    main()
