import { X } from 'lucide-react';
import type { NutritionData } from '../store/appStore';
import BottomSheet from './BottomSheet';
import {
  MICRONUTRIENT_FIELDS,
  countMicronutrients,
  formatCompactValue,
  hasMicronutrientData,
  scaleNutrition,
} from '../lib/nutrition';

interface NutritionDetailSheetProps {
  title: string;
  subtitle?: string;
  nutritionPer100g: NutritionData;
  servingG?: number;
  servingLabel?: string;
  onClose: () => void;
  showMicronutrients?: boolean;
}

function NutrientGrid({
  label,
  nutrition,
  testId,
}: {
  label: string;
  nutrition: NutritionData;
  testId?: string;
}) {
  const basicRows = [
    { label: 'Calories', value: `${nutrition.calories} kcal` },
    { label: 'Protein', value: `${formatCompactValue(nutrition.protein_g)} g` },
    { label: 'Carbs', value: `${formatCompactValue(nutrition.carbs_g)} g` },
    { label: 'Fiber', value: `${formatCompactValue(nutrition.fiber_g)} g` },
    { label: 'Sugar', value: `${formatCompactValue(nutrition.sugar_g)} g` },
    { label: 'Fat', value: `${formatCompactValue(nutrition.fat_g)} g` },
    { label: 'Sat. fat', value: `${formatCompactValue(nutrition.saturated_fat_g)} g` },
    { label: 'Sodium', value: `${formatCompactValue(nutrition.sodium_mg, 0)} mg` },
    { label: 'GI', value: nutrition.glycemic_index !== undefined ? formatCompactValue(nutrition.glycemic_index) : '—' },
    { label: 'GL', value: nutrition.glycemic_load !== undefined ? formatCompactValue(nutrition.glycemic_load) : '—' },
    { label: 'Omega-3', value: nutrition.omega3_g !== undefined ? `${formatCompactValue(nutrition.omega3_g, 2)} g` : '—' },
  ];

  const micronutrientRows = MICRONUTRIENT_FIELDS.map(({ key, label: micronutrientLabel, unit, decimals }) => ({
    label: micronutrientLabel,
    value: nutrition.micronutrients?.[key] !== undefined
      ? `${formatCompactValue(nutrition.micronutrients[key], decimals)} ${unit}`
      : '—',
  }));

  return (
    <section className="rounded-2xl border border-sand bg-cream-card p-4" data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-plum-dark">{label}</h4>
        <span className="text-[11px] text-ink-40 uppercase tracking-wide">
          {hasMicronutrientData(nutrition.micronutrients)
            ? `${countMicronutrients(nutrition.micronutrients)} micros`
            : 'Macros only'}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold text-ink-40 uppercase tracking-wide mb-2">Core nutrition</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {basicRows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <span className="text-ink-60">{row.label}</span>
                <span className="font-medium text-plum-dark text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-ink-40 uppercase tracking-wide mb-2">Micronutrients</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {micronutrientRows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <span className="text-ink-60">{row.label}</span>
                <span className="font-medium text-plum-dark text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function NutritionDetailSheet({
  title,
  subtitle,
  nutritionPer100g,
  servingG,
  servingLabel,
  onClose,
}: NutritionDetailSheetProps) {
  const servingNutrition = servingG ? scaleNutrition(nutritionPer100g, servingG / 100) : null;

  return (
    <BottomSheet onClose={onClose}>
      <div className="p-5 pb-safe max-h-[80vh] overflow-y-auto space-y-4" data-testid="nutrition-detail-sheet">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-plum-dark">{title}</h3>
            {subtitle && <p className="text-xs text-ink-40 mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="tap-target flex items-center justify-center">
            <X size={20} className="text-ink-40" />
          </button>
        </div>

        <NutrientGrid label="Per 100 g" nutrition={nutritionPer100g} testId="nutrition-detail-per-100g" />

        {servingNutrition && (
          <NutrientGrid
            label={servingLabel ? `Per serving • ${servingLabel}` : `Per serving • ${servingG} g`}
            nutrition={servingNutrition}
            testId="nutrition-detail-per-serving"
          />
        )}
      </div>
    </BottomSheet>
  );
}
