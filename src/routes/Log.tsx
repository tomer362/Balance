import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Check } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { LoggedMeal, MealItem } from '../store/appStore';
import { mealDatabase } from '../data/mealDatabase';
import { scoreFood } from '../lib/scoring';
import { getCurrentPhase } from '../lib/cyclePhase';
import ScoreBadge from '../components/ScoreBadge';

export default function Log() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const profile = useAppStore(selectActiveProfile);
  const logMeal = useAppStore((s) => s.logMeal);

  const [query, setQuery] = useState(initialQuery);
  const [loggedId, setLoggedId] = useState<string | null>(null);

  if (!profile) return null;

  const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;

  const filtered = query.length > 1
    ? mealDatabase.filter((m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.tags.some((t) => t.includes(query.toLowerCase()))
      )
    : [];

  const favorites = mealDatabase
    .filter((m) => profile.mode === 'pcos' ? m.pcos_score >= 8.5 : (m.bulk_score ?? 0) >= 8.5)
    .sort((a, b) =>
      profile.mode === 'pcos'
        ? b.pcos_score - a.pcos_score
        : (b.bulk_score ?? 0) - (a.bulk_score ?? 0)
    )
    .slice(0, 6);

  const recent = profile.foodLog
    .slice(-6)
    .reverse()
    .filter((m, i, arr) => arr.findIndex((x) => x.name === m.name) === i)
    .slice(0, 3);

  function quickLog(meal: MealItem) {
    if (!profile) return;
    const score = scoreFood(meal.nutrition, meal.nutrition.calories > 200 ? 300 : 150, profile.mode, phaseInfo?.phase);
    const logged: LoggedMeal = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      meal_type: new Date().getHours() < 10 ? 'breakfast' : new Date().getHours() < 14 ? 'lunch' : new Date().getHours() < 17 ? 'snack' : 'dinner',
      name: meal.name,
      serving_g: 300,
      nutrition: meal.nutrition,
      score,
      cyclePhase: phaseInfo?.phase,
    };
    logMeal(profile.id, logged);
    setLoggedId(meal.id);
    setTimeout(() => setLoggedId(null), 1500);
  }

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cream-bg px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sand transition-colors">
          <ArrowLeft size={20} className="text-plum-dark" />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-cream-card border border-sand rounded-2xl px-3 py-2.5">
          <Search size={16} className="text-ink-40 flex-shrink-0" />
          <input
            autoFocus={!!initialQuery}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods…"
            className="flex-1 bg-transparent text-sm text-plum-dark placeholder-ink-40 focus:outline-none"
          />
        </div>
      </div>

      <div className="px-4 pb-4 space-y-5">
        {/* Search results */}
        {query.length > 1 && (
          <section>
            <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
              Results {filtered.length > 0 ? `(${filtered.length})` : '— no matches'}
            </h2>
            <div className="space-y-2">
              {filtered.map((meal) => (
                <MealRow key={meal.id} meal={meal} profile={profile} onLog={quickLog} loggedId={loggedId} />
              ))}
            </div>
          </section>
        )}

        {/* Recent */}
        {recent.length > 0 && query.length <= 1 && (
          <section>
            <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">Recent</h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {recent.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setQuery(m.name)}
                  className="flex-shrink-0 bg-cream-card border border-sand rounded-xl px-3 py-2 text-xs font-medium text-ink-60 whitespace-nowrap"
                >
                  {m.name.split(' ').slice(0, 3).join(' ')}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Mode favorites */}
        {query.length <= 1 && (
          <section>
            <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
              {profile.mode === 'pcos' ? 'PCOS Favourites' : 'Bulk Favourites'}
            </h2>
            <div className="space-y-2">
              {favorites.map((meal) => (
                <MealRow key={meal.id} meal={meal} profile={profile} onLog={quickLog} loggedId={loggedId} />
              ))}
            </div>
          </section>
        )}

        {/* Custom */}
        <section>
          <button
            onClick={() => navigate('/scan')}
            className="w-full flex items-center gap-3 bg-cream-card border border-sand rounded-2xl px-4 py-3 text-sm font-medium text-ink-60"
          >
            <div className="w-8 h-8 rounded-xl bg-coral-accent/15 flex items-center justify-center">
              <Plus size={16} className="text-coral-accent" />
            </div>
            Scan barcode or add custom meal
          </button>
        </section>
      </div>
    </div>
  );
}

function MealRow({
  meal,
  profile,
  onLog,
  loggedId,
}: {
  meal: MealItem;
  profile: NonNullable<ReturnType<typeof selectActiveProfile>>;
  onLog: (m: MealItem) => void;
  loggedId: string | null;
}) {
  const score = profile.mode === 'pcos' ? meal.pcos_score : (meal.bulk_score ?? meal.pcos_score);
  const isLogged = loggedId === meal.id;

  return (
    <div className="bg-cream-card border border-sand rounded-2xl p-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-plum-dark">{meal.name}</span>
          <ScoreBadge score={score} size="sm" />
        </div>
        <div className="text-xs text-ink-40 mt-0.5 flex gap-2">
          <span>{meal.nutrition.calories} kcal</span>
          <span>·</span>
          <span>{meal.nutrition.protein_g}g P</span>
          <span>·</span>
          <span>{meal.prep_time_min} min</span>
        </div>
        {meal.gap_coverage.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {meal.gap_coverage.map((g) => (
              <span key={g} className="text-[10px] bg-sand text-ink-60 rounded-full px-2 py-0.5">{g}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onLog(meal)}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          isLogged ? 'bg-moss text-white scale-95' : 'bg-coral-accent text-white active:scale-95'
        }`}
      >
        {isLogged ? <Check size={18} /> : <Plus size={18} />}
      </button>
    </div>
  );
}
