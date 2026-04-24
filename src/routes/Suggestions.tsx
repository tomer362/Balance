import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { LoggedMeal } from '../store/appStore';
import { analyzeGaps, sumNutrients } from '../lib/gapAnalysis';
import { getSuggestions } from '../lib/suggestionEngine';
import { scoreFood } from '../lib/scoring';
import { getCurrentPhase } from '../lib/cyclePhase';
import GapIndicator from '../components/GapIndicator';
import ScoreBadge from '../components/ScoreBadge';

type Filter = 'all' | 'quick' | 'no-cook' | 'veg';

export default function Suggestions() {
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const logMeal = useAppStore((s) => s.logMeal);
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!profile) return null;

  const today = new Date().toISOString().split('T')[0];
  const todayMeals = profile.foodLog.filter((m) => m.timestamp.startsWith(today));
  const totals = sumNutrients(todayMeals.map((m) => m.nutrition));
  const targets = profile.targets;
  const gaps = analyzeGaps(todayMeals.map((m) => m.nutrition), targets);
  const remaining = Math.max(0, targets.calories - totals.calories);
  const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;

  let suggestions = getSuggestions(profile, 10);

  if (filter === 'quick') suggestions = suggestions.filter((m) => m.prep_time_min <= 15);
  if (filter === 'no-cook') suggestions = suggestions.filter((m) => m.tags.includes('no-cook'));
  if (filter === 'veg') suggestions = suggestions.filter((m) => m.dietary.includes('vegetarian') || m.dietary.includes('vegan'));

  const [best, ...rest] = suggestions;

  function handleLog(meal: typeof suggestions[0]) {
    if (!profile) return;
    const score = scoreFood(meal.nutrition, 300, profile.mode, phaseInfo?.phase);
    const now = new Date();
    const logged: LoggedMeal = {
      id: `sug-${Date.now()}`,
      timestamp: now.toISOString(),
      meal_type: now.getHours() < 10 ? 'breakfast' : now.getHours() < 14 ? 'lunch' : now.getHours() < 17 ? 'snack' : 'dinner',
      name: meal.name,
      serving_g: 300,
      nutrition: meal.nutrition,
      score,
      cyclePhase: phaseInfo?.phase,
    };
    logMeal(profile.id, logged);
    navigate('/');
  }

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      <div className="sticky top-0 z-10 bg-cream-bg px-4 pt-4 pb-3 border-b border-sand/50">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sand">
            <ArrowLeft size={20} className="text-plum-dark" />
          </button>
          <h1 className="font-semibold text-plum-dark">Meal ideas</h1>
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-ink-60">
            <span className="font-semibold text-plum-dark">{Math.round(remaining)} kcal</span> remaining today
          </p>
        </div>

        {/* Gaps */}
        <GapIndicator gaps={gaps} />

        {/* Filters */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1">
          {(['all', 'quick', 'no-cook', 'veg'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-sage-deep text-white'
                  : 'bg-sand text-ink-60'
              }`}
            >
              {f === 'quick' ? '< 15 min' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Best match */}
        {best && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🏆</span>
              <h2 className="text-xs font-bold text-ink-60 uppercase tracking-wide">Best match</h2>
            </div>
            <div className="bg-cream-card rounded-3xl border border-sand overflow-hidden shadow-sm">
              <div className="bg-gradient-to-br from-sage-primary/10 to-transparent p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-base font-semibold text-plum-dark leading-snug flex-1">{best.name}</h3>
                  <ScoreBadge score={best.pcos_score} size="lg" />
                </div>
                <div className="flex gap-3 text-sm text-ink-60 mb-3">
                  <span>{best.nutrition.calories} kcal</span>
                  <span>·</span>
                  <span>{best.prep_time_min} min</span>
                  <span>·</span>
                  <span>{best.nutrition.protein_g}g protein</span>
                </div>
                {best.closedGaps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {best.closedGaps.map((g) => (
                      <span key={g} className="text-xs bg-moss/15 text-moss rounded-full px-2.5 py-1 font-medium">
                        ✓ {g}
                      </span>
                    ))}
                  </div>
                )}
                {best.nutrition.glycemic_load && (
                  <p className="text-xs text-ink-40 mb-3">
                    GL impact: +{best.nutrition.glycemic_load} ({best.nutrition.glycemic_load < 10 ? 'very low' : best.nutrition.glycemic_load < 20 ? 'low' : 'moderate'})
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setExpandedId(expandedId === best.id ? null : best.id)}
                    className="flex-1 border border-sage-primary text-sage-deep rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1"
                  >
                    View recipe <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => handleLog(best)}
                    className="flex-1 bg-coral-accent text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1"
                  >
                    <Plus size={16} /> Log now
                  </button>
                </div>
              </div>

              {expandedId === best.id && best.instructions && (
                <div className="px-4 pb-4 pt-2 border-t border-sand">
                  <h4 className="text-xs font-semibold text-ink-60 uppercase tracking-wide mb-2">Instructions</h4>
                  <ol className="space-y-1.5">
                    {best.instructions.map((step, i) => (
                      <li key={i} className="text-sm text-ink-60 flex gap-2">
                        <span className="flex-shrink-0 w-4 text-ink-40 font-mono-num">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Also good */}
        {rest.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🥈</span>
              <h2 className="text-xs font-bold text-ink-60 uppercase tracking-wide">Also good</h2>
            </div>
            <div className="space-y-2.5">
              {rest.map((meal) => (
                <div key={meal.id} className="bg-cream-card rounded-2xl border border-sand p-3.5">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="text-sm font-semibold text-plum-dark leading-snug flex-1">{meal.name}</h3>
                    <ScoreBadge score={meal.pcos_score} size="sm" />
                  </div>
                  <div className="flex gap-2 text-xs text-ink-40 mb-2">
                    <span>{meal.nutrition.calories} kcal</span>
                    <span>·</span>
                    <span>{meal.prep_time_min} min</span>
                    {meal.tags.includes('no-cook') && <span className="text-sage-deep font-medium">NO-COOK</span>}
                  </div>
                  {meal.closedGaps.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {meal.closedGaps.map((g) => (
                        <span key={g} className="text-[10px] text-moss bg-moss/10 rounded-full px-2 py-0.5">✓ {g}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setExpandedId(expandedId === meal.id ? null : meal.id)}
                      className="flex-1 text-xs border border-sand text-ink-60 rounded-lg py-2 font-medium"
                    >
                      Recipe
                    </button>
                    <button
                      onClick={() => handleLog(meal)}
                      className="flex-1 text-xs bg-coral-accent text-white rounded-lg py-2 font-semibold"
                    >
                      + Log
                    </button>
                  </div>

                  {expandedId === meal.id && meal.instructions && (
                    <div className="mt-3 pt-3 border-t border-sand">
                      <ol className="space-y-1">
                        {meal.instructions.map((step, i) => (
                          <li key={i} className="text-xs text-ink-60 flex gap-2">
                            <span className="flex-shrink-0 w-3 text-ink-40">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {suggestions.length === 0 && (
          <div className="text-center py-12 text-ink-40 text-sm">
            No suggestions match this filter. Try "All".
          </div>
        )}
      </div>
    </div>
  );
}
