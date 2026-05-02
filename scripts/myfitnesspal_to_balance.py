#!/usr/bin/env python3
"""Convert permitted MyFitnessPal-style nutrition exports into Balance meals.

This script intentionally works from local CSV/JSON exports or authorized API
responses. It does not log in to, crawl, or bypass MyFitnessPal pages.

Examples:
  python3 scripts/myfitnesspal_to_balance.py input.csv src/data/importedMealDatabase.json
  python3 scripts/myfitnesspal_to_balance.py input.json src/data/importedMealDatabase.json
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
from typing import Any


FIELD_ALIASES = {
    "name": ["name", "food", "food_name", "meal", "description"],
    "brand": ["brand", "brand_name"],
    "serving_g": ["serving_g", "serving grams", "serving_weight_grams", "grams"],
    "calories": ["calories", "energy_kcal", "kcal"],
    "protein_g": ["protein_g", "protein", "protein (g)"],
    "carbs_g": ["carbs_g", "carbohydrates", "carbs", "carbohydrates (g)"],
    "fiber_g": ["fiber_g", "fiber", "fiber (g)"],
    "sugar_g": ["sugar_g", "sugar", "sugars", "sugars (g)"],
    "fat_g": ["fat_g", "fat", "total fat", "fat (g)"],
    "saturated_fat_g": ["saturated_fat_g", "saturated fat", "sat fat", "saturated fat (g)"],
    "sodium_mg": ["sodium_mg", "sodium", "sodium (mg)"],
}


def norm_key(value: str) -> str:
    return value.strip().lower().replace("_", " ")


def get_value(row: dict[str, Any], field: str, default: Any = None) -> Any:
    normalized = {norm_key(k): v for k, v in row.items()}
    for alias in FIELD_ALIASES[field]:
        key = norm_key(alias)
        if key in normalized and normalized[key] not in ("", None):
            return normalized[key]
    return default


def nutritional_contents(row: dict[str, Any]) -> dict[str, Any]:
    contents = row.get("nutritional_contents")
    return contents if isinstance(contents, dict) else {}


def measured_value(value: Any, default: float = 0) -> float:
    if isinstance(value, dict):
        return number(value.get("value"), default)
    return number(value, default)


def nutrient(row: dict[str, Any], field: str, content_key: str | None = None) -> float:
    direct = get_value(row, field)
    if direct not in ("", None):
        return number(direct)
    contents = nutritional_contents(row)
    key = content_key or field
    return measured_value(contents.get(key), 0)


def number(value: Any, default: float = 0) -> float:
    if value in ("", None):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return default


def make_id(name: str, brand: str | None, nutrition: dict[str, Any]) -> str:
    seed = json.dumps(
        {"name": name, "brand": brand, "nutrition": nutrition},
        sort_keys=True,
        ensure_ascii=True,
    )
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:10]
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in name).strip("-")
    slug = "-".join(part for part in slug.split("-") if part)[:50]
    return f"{slug}-{digest}" if slug else digest


def meal_types_for(row: dict[str, Any]) -> list[str]:
    raw = row.get("meal_types") or row.get("meal_type") or row.get("meal")
    if isinstance(raw, list):
        values = raw
    elif isinstance(raw, str):
        values = [part.strip() for part in raw.replace(";", ",").split(",")]
    else:
        values = []

    allowed = {"breakfast", "lunch", "dinner", "snack"}
    cleaned = [v for v in (str(x).lower().strip() for x in values) if v in allowed]
    return cleaned or ["lunch", "dinner", "snack"]


def tags_for(row: dict[str, Any], nutrition: dict[str, Any]) -> list[str]:
    tags: set[str] = {"imported", "myfitnesspal"}
    raw = row.get("tags")
    if isinstance(raw, list):
        tags.update(str(t).strip().lower() for t in raw if str(t).strip())
    elif isinstance(raw, str):
        tags.update(t.strip().lower() for t in raw.replace(";", ",").split(",") if t.strip())

    if nutrition["protein_g"] >= 20:
        tags.add("high-protein")
    if nutrition["fiber_g"] >= 6:
        tags.add("high-fiber")
    if nutrition["calories"] >= 500:
        tags.add("high-calorie")
    if nutrition["carbs_g"] >= 45:
        tags.add("high-carb")
    return sorted(tags)


def normalize_row(row: dict[str, Any]) -> dict[str, Any] | None:
    name = str(get_value(row, "name", "")).strip()
    if not name and row.get("type") == "diary_meal":
        date = str(row.get("date", "")).strip()
        meal = str(row.get("diary_meal", "Meal")).strip() or "Meal"
        name = f"{meal} summary{f' {date}' if date else ''}"
    if not name:
        return None

    brand_raw = get_value(row, "brand")
    brand = str(brand_raw).strip() if brand_raw not in ("", None) else None
    nutrition = {
        "calories": round(nutrient(row, "calories", "energy")),
        "protein_g": round(nutrient(row, "protein_g", "protein"), 1),
        "carbs_g": round(nutrient(row, "carbs_g", "carbohydrates"), 1),
        "fiber_g": round(nutrient(row, "fiber_g", "fiber"), 1),
        "sugar_g": round(nutrient(row, "sugar_g", "sugar"), 1),
        "fat_g": round(nutrient(row, "fat_g", "fat"), 1),
        "saturated_fat_g": round(nutrient(row, "saturated_fat_g", "saturated_fat"), 1),
        "sodium_mg": round(nutrient(row, "sodium_mg", "sodium")),
    }
    serving_g = number(get_value(row, "serving_g"), 100)

    return {
        "id": make_id(name, brand, nutrition),
        "name": name,
        **({"brand": brand} if brand else {}),
        "source": "myfitnesspal",
        "serving_g": serving_g,
        "prep_time_min": round(number(row.get("prep_time_min"), 10)),
        "meal_types": meal_types_for(row),
        "tags": tags_for(row, nutrition),
        "dietary": row.get("dietary", []) if isinstance(row.get("dietary"), list) else [],
        "nutrition": nutrition,
    }


def read_input(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))

    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("foods", "meals", "items", "entries", "data"):
            if isinstance(data.get(key), list):
                return data[key]
    raise ValueError("JSON input must be an array or contain foods/meals/items/entries/data array")


def merge_existing(existing_path: Path, incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    existing: list[dict[str, Any]] = []
    if existing_path.exists():
        existing_data = json.loads(existing_path.read_text(encoding="utf-8"))
        if isinstance(existing_data, list):
            existing = existing_data

    by_id = {item["id"]: item for item in existing if isinstance(item, dict) and item.get("id")}
    for item in incoming:
        by_id[item["id"]] = item
    return sorted(by_id.values(), key=lambda x: x["name"].lower())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="CSV/JSON export or authorized API response")
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=Path("src/data/importedMealDatabase.json"),
        help="Balance imported meal database JSON",
    )
    parser.add_argument("--replace", action="store_true", help="Replace output instead of merging by id")
    args = parser.parse_args()

    rows = read_input(args.input)
    normalized = [item for item in (normalize_row(row) for row in rows) if item]
    output = normalized if args.replace else merge_existing(args.output, normalized)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(output)} meals to {args.output}")


if __name__ == "__main__":
    main()
