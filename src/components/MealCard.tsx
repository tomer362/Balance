import { useState } from 'react';
import { Trash2, Edit3, Info } from 'lucide-react';
import type { LoggedMeal } from '../store/appStore';
import ScoreBadge from './ScoreBadge';
import { formatCompactAmount, formatTimeValue, mealTypeLabel, useI18n } from '../lib/i18n';

interface MealCardProps {
  meal: LoggedMeal;
  onDelete?: () => void;
  onEdit?: () => void;
  onViewNutrition?: () => void;
}

function mealTypeEmoji(type: LoggedMeal['meal_type']): string {
  const map: Record<string, string> = {
    breakfast: '🌅',
    lunch: '🌞',
    dinner: '🌙',
    snack: '🍎',
    pre_workout: '⚡',
    post_workout: '💪',
  };
  return map[type] ?? '🍽️';
}

export default function MealCard({ meal, onDelete, onEdit, onViewNutrition }: MealCardProps) {
  const [showActions, setShowActions] = useState(false);
  const { copy, language } = useI18n();

  return (
    <div
      className="bg-cream-card rounded-2xl p-4 shadow-sm border border-sand/60 card-press"
      onClick={() => showActions && setShowActions(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xl leading-none mt-0.5">{mealTypeEmoji(meal.meal_type)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-plum-dark truncate text-sm">{meal.name}</span>
              <ScoreBadge score={meal.score} size="sm" />
            </div>
            <div className="text-xs text-ink-40 mt-0.5">
              {formatTimeValue(meal.timestamp, language)} · {formatCompactAmount(Math.round(meal.nutrition.calories), ` ${copy.common.kcal}`, language, 0)}
            </div>
            <div className="text-xs text-ink-60 mt-1 flex gap-2.5 flex-wrap">
              <span>{formatCompactAmount(Math.round(meal.nutrition.protein_g), `g ${copy.common.protein}`, language, 0)}</span>
              <span>{formatCompactAmount(Math.round(meal.nutrition.carbs_g), `g ${copy.common.carbs}`, language, 0)}</span>
              <span>{formatCompactAmount(Math.round(meal.nutrition.fat_g), `g ${copy.common.fat}`, language, 0)}</span>
              {meal.nutrition.fiber_g > 0 && <span>{formatCompactAmount(Math.round(meal.nutrition.fiber_g), `g ${copy.common.fiber}`, language, 0)}</span>}
            </div>
            <div className="text-[10px] text-ink-40 mt-1">{mealTypeLabel(meal.meal_type, language)}</div>
          </div>
        </div>

        {(onDelete || onEdit || onViewNutrition) && (
          <div className="flex gap-1 flex-shrink-0">
            {onViewNutrition && (
              <button
                data-testid="meal-card-nutrition"
                onClick={onViewNutrition}
                className="p-1.5 rounded-lg text-ink-40 hover:text-sage-deep hover:bg-sand transition-colors"
              >
                <Info size={15} />
              </button>
            )}
            {onEdit && (
              <button
                data-testid="meal-card-edit"
                onClick={onEdit}
                className="p-1.5 rounded-lg text-ink-40 hover:text-sage-deep hover:bg-sand transition-colors"
              >
                <Edit3 size={15} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-ink-40 hover:text-terracotta hover:bg-terracotta/10 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
