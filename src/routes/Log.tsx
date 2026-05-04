import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Check, ChevronRight, X, Minus, Layers } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { LoggedMeal, MealItem, NutritionData } from '../store/appStore';
import { allMeals } from '../data/allMeals';
import { ingredientDatabase, ingredientToNutrition, searchIngredients, scaleIngredient } from '../data/ingredientDatabase';
import type { Ingredient } from '../data/ingredientDatabase';
import { searchFoodIsrael } from '../lib/openFoodFacts';
import { scoreFood } from '../lib/scoring';
import { getCurrentPhase } from '../lib/cyclePhase';
import { countMicronutrients, formatCompactValue, hasMicronutrientData, scaleNutrition, sumNutrition } from '../lib/nutrition';
import ScoreBadge from '../components/ScoreBadge';
import BottomSheet from '../components/BottomSheet';
import NutritionDetailSheet from '../components/NutritionDetailSheet';
import { directionalIconClass, formatAmountWithUnit, ingredientDisplayName, mealDisplayName, useI18n } from '../lib/i18n';

type TabKey = 'meals' | 'ingredients' | 'build';

function isTabKey(value: string | null): value is TabKey {
  return value === 'meals' || value === 'ingredients' || value === 'build';
}

// ─── helpers ────────────────────────────────────────────────────────────────

function autoMealType(): LoggedMeal['meal_type'] {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

function sumNutr(items: Array<{ nutrition: NutritionData; serving_g: number }>): NutritionData {
  return sumNutrition(items.map(({ nutrition, serving_g }) => scaleNutrition(nutrition, serving_g / 100)));
}

function nutritionSheetSubtitle(nutrition: NutritionData, suffix?: string): string {
  if (hasMicronutrientData(nutrition.micronutrients)) {
    return `${countMicronutrients(nutrition.micronutrients)} micronutrients available${suffix ? ` · ${suffix}` : ''}`;
  }

  return suffix
    ? `Micronutrients not available for this item yet · ${suffix}`
    : 'Micronutrients not available for this item yet';
}

function rowSummary(nutrition: NutritionData): string {
  return `${nutrition.calories} kcal/100g · ${formatCompactValue(nutrition.protein_g)}g P · ${formatCompactValue(nutrition.carbs_g)}g C · ${formatCompactValue(nutrition.fat_g)}g F`;
}

// ─── serving picker component ────────────────────────────────────────────────

interface ServingPickerProps {
  defaultG: number;
  defaultLabel: string;
  onConfirm: (g: number) => void;
  onCancel: () => void;
}

type ServingUnit = 'g' | 'ml';

function parseMlFromServingLabel(label: string): number | null {
  const match = label.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function ServingPicker({ defaultG, defaultLabel, onConfirm, onCancel }: ServingPickerProps) {
  const { copy, language } = useI18n();
  const defaultMl = parseMlFromServingLabel(defaultLabel);
  const displayUnit: ServingUnit = defaultMl ? 'ml' : 'g';
  const gramsPerMl = defaultMl ? defaultG / defaultMl : 1;
  const defaultAmount = displayUnit === 'ml' ? Math.round(defaultMl ?? defaultG) : defaultG;

  const [amountText, setAmountText] = useState(String(defaultAmount));
  const amount = Math.max(1, Number(amountText) || defaultAmount);
  const grams = Math.max(1, Math.round(amount * gramsPerMl));

  const step = displayUnit === 'ml' ? 10 : 10;
  const presets = displayUnit === 'ml' ? [50, 100, 150, 200, 250, 300] : [50, 100, 150, 200, 250, 300];

  return (
    <BottomSheet onClose={onCancel}>
      <div className="p-6 pb-safe space-y-4" data-testid="serving-picker">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-plum-dark">{copy.log.servingSize}</h3>
          <button onClick={onCancel} className="tap-target flex items-center justify-center">
            <X size={20} className="text-ink-40" />
          </button>
        </div>

        <p className="text-xs text-ink-40">{copy.log.defaultServing}: {defaultLabel}</p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAmountText(String(Math.max(1, amount - step)))}
            className="tap-target w-11 h-11 rounded-full bg-sand flex items-center justify-center"
            data-testid="serving-minus"
          >
            <Minus size={18} className="text-plum-dark" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-cream-card border border-sand rounded-xl px-3 py-2.5">
            <input
              type="number"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="flex-1 bg-transparent text-center text-lg font-semibold text-plum-dark focus:outline-none"
              data-testid="serving-input"
            />
              <span className="text-sm text-ink-40">
                {displayUnit === 'ml' ? (language === 'he' ? 'מ״ל' : 'ml') : language === 'he' ? 'גרם' : 'g'}
              </span>
          </div>
          <button
            onClick={() => setAmountText(String(amount + step))}
            className="tap-target w-11 h-11 rounded-full bg-sand flex items-center justify-center"
            data-testid="serving-plus"
          >
            <Plus size={18} className="text-plum-dark" />
          </button>
        </div>

        {/* quick presets */}
        <div className="flex gap-2 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmountText(String(preset))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                amount === preset ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'
              }`}
            >
              {formatAmountWithUnit(preset, displayUnit, language)}
            </button>
          ))}
        </div>

        <button
          onClick={() => onConfirm(grams)}
          className="w-full bg-sage-deep text-white py-3.5 rounded-2xl font-semibold"
          data-testid="serving-confirm"
        >
          {copy.log.addToLog}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

interface BuildItem {
  ingredient: Ingredient;
  serving_g: number;
}

interface NutritionSheetState {
  title: string;
  subtitle?: string;
  nutritionPer100g: NutritionData;
  servingG?: number;
  servingLabel?: string;
}

export default function Log() {
  const { copy, language } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const tabParam = searchParams.get('tab');
  const initialTab: TabKey = isTabKey(tabParam) ? tabParam : 'ingredients';

  const profile = useAppStore(selectActiveProfile);
  const logMeal = useAppStore((s) => s.logMeal);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState(initialQuery);

  // Meal-tab state
  const [loggedMealId, setLoggedMealId] = useState<string | null>(null);

  // Ingredient-tab state
  const [ingResults, setIngResults] = useState<Ingredient[]>([]);
  const [offResults, setOffResults] = useState<Array<{ id: string; name: string; nutrition: NutritionData }>>([]);
  const [offLoading, setOffLoading] = useState(false);
  const [pendingIngredient, setPendingIngredient] = useState<Ingredient | null>(null);
  const [pendingOff, setPendingOff] = useState<{ id: string; name: string; nutrition: NutritionData } | null>(null);
  const [nutritionSheet, setNutritionSheet] = useState<NutritionSheetState | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build-a-meal state
  const [buildItems, setBuildItems] = useState<BuildItem[]>([]);
  const [buildMealName, setBuildMealName] = useState('');
  const [buildPendingIngredient, setBuildPendingIngredient] = useState<Ingredient | null>(null);

  const phaseInfo = profile?.mode === 'pcos' ? getCurrentPhase(profile!) : null;
  const customMealLabel = copy.log.customMeal;

  // ── search effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isTabKey(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== 'ingredients' || query.length < 2) {
      setIngResults([]);
      setOffResults([]);
      return;
    }
    // Local search is instant
    setIngResults(searchIngredients(query));

    // OFF search is debounced
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setOffLoading(true);
      const results = await searchFoodIsrael(query);
      setOffResults(results);
      setOffLoading(false);
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeTab]);

  // ── actions ────────────────────────────────────────────────────────────────
  const logIngredient = useCallback(
    (ingredient: Ingredient, servingG: number) => {
      if (!profile) return;
      const scaled = scaleIngredient(ingredient, servingG);
      const nutrition = scaled;
      const score = scoreFood(nutrition, servingG, profile.mode, phaseInfo?.phase);
      const logged: LoggedMeal = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        meal_type: autoMealType(),
        food_id: ingredient.id,
        name: `${ingredientDisplayName(ingredient, language)} (${servingG} g)`,
        serving_g: servingG,
        nutrition,
        score,
        cyclePhase: phaseInfo?.phase,
      };
      logMeal(profile.id, logged);
      setPendingIngredient(null);
    },
    [profile, logMeal, phaseInfo, language]
  );

  const logOff = useCallback(
    (item: { id: string; name: string; nutrition: NutritionData }, servingG: number) => {
      if (!profile) return;
      const nutrition = scaleNutrition(item.nutrition, servingG / 100);
      const score = scoreFood(nutrition, servingG, profile.mode, phaseInfo?.phase);
      const logged: LoggedMeal = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        meal_type: autoMealType(),
        food_id: item.id,
        name: `${item.name} (${servingG} g)`,
        serving_g: servingG,
        nutrition,
        score,
        cyclePhase: phaseInfo?.phase,
      };
      logMeal(profile.id, logged);
      setPendingOff(null);
    },
    [profile, logMeal, phaseInfo]
  );

  const quickLogMeal = useCallback(
    (meal: MealItem) => {
      if (!profile) return;
      const score = scoreFood(meal.nutrition, 300, profile.mode, phaseInfo?.phase);
      const logged: LoggedMeal = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        meal_type: autoMealType(),
        name: meal.name,
        serving_g: 300,
        nutrition: meal.nutrition,
        score,
        cyclePhase: phaseInfo?.phase,
      };
      logMeal(profile.id, logged);
      setLoggedMealId(meal.id);
      setTimeout(() => setLoggedMealId(null), 1500);
    },
    [profile, logMeal, phaseInfo]
  );

  const logBuildMeal = useCallback(() => {
    if (!profile || buildItems.length === 0) return;
    const totalG = buildItems.reduce((s, i) => s + i.serving_g, 0);
    const nutritionPer100 = buildItems.map((bi) => ({
      nutrition: ingredientToNutrition(bi.ingredient),
      serving_g: bi.serving_g,
    }));
    const nutrition = sumNutr(nutritionPer100);
    const score = scoreFood(nutrition, totalG, profile.mode, phaseInfo?.phase);
    const logged: LoggedMeal = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      meal_type: autoMealType(),
        name: buildMealName.trim() || customMealLabel,
      serving_g: totalG,
      nutrition,
      score,
      cyclePhase: phaseInfo?.phase,
    };
    logMeal(profile.id, logged);
    setBuildItems([]);
    setBuildMealName('');
    navigate(-1);
  }, [profile, logMeal, phaseInfo, buildItems, buildMealName, navigate, customMealLabel]);

  if (!profile) return null;

  const mealFiltered = query.length > 1
    ? allMeals.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.tags.some((t) => t.includes(query.toLowerCase()))
      )
    : [];

  const favorites = allMeals
    .filter((m) => (profile.mode === 'pcos' ? m.pcos_score >= 8.5 : (m.bulk_score ?? 0) >= 8.5))
    .sort((a, b) =>
      profile.mode === 'pcos' ? b.pcos_score - a.pcos_score : (b.bulk_score ?? 0) - (a.bulk_score ?? 0)
    )
    .slice(0, 6);

  const recent = profile.foodLog
    .slice(-8)
    .reverse()
    .filter((m, i, arr) => arr.findIndex((x) => x.name === m.name) === i)
    .slice(0, 4);

  const allIngredients = [...ingredientDatabase].sort((a, b) => {
    const aName = language === 'he' ? (a.nameHe ?? a.name) : a.name;
    const bName = language === 'he' ? (b.nameHe ?? b.name) : b.name;
    return aName.localeCompare(bName, language === 'he' ? 'he' : 'en');
  });

  // Build-a-meal totals preview
  const buildTotals = buildItems.length > 0
    ? sumNutr(buildItems.map((bi) => ({
        nutrition: ingredientToNutrition(bi.ingredient),
        serving_g: bi.serving_g,
      })))
    : null;

  return (
    <div className="main-content min-h-screen bg-cream-bg flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cream-bg px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="tap-target flex items-center justify-center rounded-full hover:bg-sand transition-colors">
            <ArrowLeft size={20} className={`text-plum-dark ${directionalIconClass(language)}`} />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-cream-card border border-sand rounded-2xl px-3 py-2.5">
            <Search size={16} className="text-ink-40 flex-shrink-0" />
            <input
              autoFocus={!!initialQuery}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
               placeholder={activeTab === 'meals' ? copy.log.searchMeals : copy.log.searchIngredients}
              className="flex-1 bg-transparent text-sm text-plum-dark placeholder-ink-40 focus:outline-none"
            />
            {query.length > 0 && (
              <button onClick={() => setQuery('')} className="tap-target flex items-center justify-center">
                <X size={14} className="text-ink-40" />
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-sand/50 rounded-xl p-1">
          {([
             { key: 'ingredients', label: copy.log.tabs.ingredients },
             { key: 'meals', label: copy.log.tabs.meals },
             { key: 'build', label: copy.log.tabs.build },
           ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-cream-bg text-plum-dark shadow-sm'
                  : 'text-ink-40'
              }`}
            >
               {tab.key === 'build' && buildItems.length > 0 ? copy.log.tabs.buildCount(buildItems.length) : tab.label}
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-5 overflow-y-auto">

        {/* ── INGREDIENTS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'ingredients' && (
          <>
            {query.length >= 2 ? (
              <>
                {/* Local results */}
                {ingResults.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                       {copy.log.ingredientsCount(ingResults.length)}
                    </h2>
                    <div className="space-y-2">
                      {ingResults.map((ing) => (
                        <IngredientRow
                          key={ing.id}
                          ingredient={ing}
                          mode={profile.mode}
                          language={language}
                          onAdd={() => setPendingIngredient(ing)}
                          onView={() => setNutritionSheet({
                            title: language === 'he' ? (ing.nameHe ?? ing.name) : ing.name,
                            subtitle: hasMicronutrientData(ing.micronutrients)
                               ? copy.log.microAvailable(countMicronutrients(ing.micronutrients))
                               : copy.log.ingredientMicroUnavailable,
                            nutritionPer100g: ingredientToNutrition(ing),
                            servingG: ing.common_serving_g,
                            servingLabel: ing.common_serving_label,
                          })}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* OFF Israel results */}
                {(offLoading || offResults.length > 0) && (
                  <section>
                    <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                       {copy.log.israeliProducts} {offLoading ? '…' : `(${offResults.length})`}
                    </h2>
                    {!offLoading && (
                      <div className="space-y-2">
                        {offResults.map((item) => (
                          <OFFRow
                            key={item.id}
                            item={item}
                            onAdd={() => setPendingOff(item)}
                            onView={() => setNutritionSheet({
                              title: item.name,
                              subtitle: hasMicronutrientData(item.nutrition.micronutrients)
                                 ? copy.log.productMicroSource
                                 : copy.log.productMicroUnavailable,
                              nutritionPer100g: item.nutrition,
                              servingG: 100,
                               servingLabel: formatAmountWithUnit(100, 'g', language),
                            })}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {ingResults.length === 0 && offResults.length === 0 && !offLoading && (
                   <p className="text-sm text-ink-40 text-center py-8">{copy.log.noIngredientsFound(query)}</p>
                )}
              </>
            ) : (
              <>
                {/* Recent */}
                {recent.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">{copy.log.recent}</h2>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {recent.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setQuery(m.name.replace(/ \(\d+ g\)$/, ''))}
                          className="flex-shrink-0 bg-cream-card border border-sand rounded-xl px-3 py-2 text-xs font-medium text-ink-60 whitespace-nowrap"
                        >
                          {m.name.replace(/ \(\d+ g\)$/, '').split(' ').slice(0, 3).join(' ')}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Full ingredient list */}
                <section>
                  <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                     {copy.log.allIngredients(ingredientDatabase.length)}
                   </h2>
                   <p className="text-xs text-ink-40 mb-3">
                     {copy.log.bundledDatabase}
                   </p>
                  <div className="space-y-2">
                    {allIngredients
                      .map((ing) => (
                        <IngredientRow
                          key={ing.id}
                          ingredient={ing}
                          mode={profile.mode}
                          language={language}
                          onAdd={() => setPendingIngredient(ing)}
                          onView={() => setNutritionSheet({
                            title: language === 'he' ? (ing.nameHe ?? ing.name) : ing.name,
                            subtitle: hasMicronutrientData(ing.micronutrients)
                               ? copy.log.microAvailable(countMicronutrients(ing.micronutrients))
                               : copy.log.ingredientMicroUnavailable,
                            nutritionPer100g: ingredientToNutrition(ing),
                            servingG: ing.common_serving_g,
                            servingLabel: ing.common_serving_label,
                          })}
                        />
                      ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ── MEALS TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'meals' && (
          <>
            {query.length > 1 ? (
              <section>
                <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                   {copy.log.results(mealFiltered.length)}
                 </h2>
                <div className="space-y-2">
                  {mealFiltered.map((meal) => (
                    <MealRow
                      key={meal.id}
                      meal={meal}
                      profile={profile}
                      onView={() => setNutritionSheet({
                         title: mealDisplayName(meal, language),
                         subtitle: nutritionSheetSubtitle(meal.nutrition, copy.log.recipeNutrition),
                        nutritionPer100g: scaleNutrition(meal.nutrition, 100 / 300),
                        servingG: 300,
                         servingLabel: copy.log.defaultServingLabel,
                      })}
                      onLog={quickLogMeal}
                      loggedId={loggedMealId}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <>
                {recent.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">{copy.log.recent}</h2>
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
                <section>
                  <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                     {profile.mode === 'pcos' ? copy.log.pcosFavorites : copy.log.bulkFavorites}
                  </h2>
                  <div className="space-y-2">
                    {favorites.map((meal) => (
                      <MealRow
                        key={meal.id}
                        meal={meal}
                        profile={profile}
                        onView={() => setNutritionSheet({
                           title: mealDisplayName(meal, language),
                           subtitle: nutritionSheetSubtitle(meal.nutrition, copy.log.recipeNutrition),
                          nutritionPer100g: scaleNutrition(meal.nutrition, 100 / 300),
                          servingG: 300,
                           servingLabel: copy.log.defaultServingLabel,
                        })}
                        onLog={quickLogMeal}
                        loggedId={loggedMealId}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ── BUILD A MEAL TAB ────────────────────────────────────────────── */}
        {activeTab === 'build' && (
          <>
            {/* Ingredient search for build */}
            {query.length >= 2 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                   {copy.log.addToMeal}
                </h2>
                <div className="space-y-2">
                  {searchIngredients(query).map((ing) => (
                    <IngredientRow
                      key={ing.id}
                      ingredient={ing}
                      mode={profile.mode}
                      language={language}
                      onAdd={() => setBuildPendingIngredient(ing)}
                      onView={() => setNutritionSheet({
                        title: language === 'he' ? (ing.nameHe ?? ing.name) : ing.name,
                        subtitle: hasMicronutrientData(ing.micronutrients)
                           ? copy.log.microAvailable(countMicronutrients(ing.micronutrients))
                           : copy.log.ingredientMicroUnavailable,
                        nutritionPer100g: ingredientToNutrition(ing),
                        servingG: ing.common_serving_g,
                        servingLabel: ing.common_serving_label,
                      })}
                       actionLabel={copy.log.add}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Items in build */}
            {buildItems.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">
                   {copy.log.inThisMeal(buildItems.length)}
                </h2>
                <div className="space-y-2">
                  {buildItems.map((bi, idx) => (
                    <div
                      key={`${bi.ingredient.id}-${idx}`}
                      className="bg-cream-card border border-sand rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                         <p className="text-sm font-medium text-plum-dark truncate">{ingredientDisplayName(bi.ingredient, language)}</p>
                         <p className="text-xs text-ink-40">{formatAmountWithUnit(bi.serving_g, 'g', language)} · {formatAmountWithUnit(Math.round(bi.ingredient.calories * bi.serving_g / 100), copy.common.kcal, language)}</p>
                       </div>
                      <button
                        onClick={() => setNutritionSheet({
                           title: ingredientDisplayName(bi.ingredient, language),
                           subtitle: copy.log.thisCustomMeal(bi.serving_g),
                          nutritionPer100g: ingredientToNutrition(bi.ingredient),
                          servingG: bi.serving_g,
                           servingLabel: formatAmountWithUnit(bi.serving_g, 'g', language),
                        })}
                        className="text-xs font-medium text-sage-deep whitespace-nowrap"
                      >
                         {copy.log.details}
                      </button>
                      <button
                        onClick={() => setBuildItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="tap-target flex items-center justify-center"
                      >
                        <X size={16} className="text-ink-40" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Totals preview */}
            {buildTotals && (
              <div className="bg-cream-card border border-sage-primary/30 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                   <p className="text-xs font-semibold text-ink-40 uppercase tracking-wide">{copy.log.mealTotals}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const totalG = buildItems.reduce((sum, item) => sum + item.serving_g, 0);
                      setNutritionSheet({
                         title: buildMealName.trim() || copy.log.customMeal,
                         subtitle: nutritionSheetSubtitle(buildTotals, `${totalG} g total`),
                        nutritionPer100g: scaleNutrition(buildTotals, 100 / totalG),
                        servingG: totalG,
                         servingLabel: `${totalG} g total`,
                      });
                    }}
                    className="text-xs font-medium text-sage-deep"
                    data-testid="build-meal-detail-btn"
                  >
                     {copy.log.fullNutrition}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'kcal', val: buildTotals.calories },
                     { label: copy.common.protein, val: `${buildTotals.protein_g}g` },
                     { label: copy.common.carbs, val: `${buildTotals.carbs_g}g` },
                     { label: copy.common.fat, val: `${buildTotals.fat_g}g` },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-sm font-bold text-plum-dark">{val}</p>
                      <p className="text-[10px] text-ink-40">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meal name + log button */}
            {buildItems.length > 0 && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={buildMealName}
                  onChange={(e) => setBuildMealName(e.target.value)}
                   placeholder={copy.log.nameThisMeal}
                  className="w-full px-4 py-3 rounded-2xl border border-sand bg-cream-card text-plum-dark placeholder-ink-40 focus:outline-none focus:border-sage-primary"
                />
                <button
                  onClick={logBuildMeal}
                  className="w-full bg-sage-deep text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2"
                >
                  <Layers size={18} />
                   {copy.log.logMeal(buildItems.length)}
                 </button>
               </div>
             )}

            {buildItems.length === 0 && query.length < 2 && (
              <div className="text-center py-12">
                <Layers size={36} className="mx-auto text-ink-40 mb-3" />
                 <p className="text-sm font-medium text-ink-60 mb-1">{copy.log.buildMealEmptyTitle}</p>
                 <p className="text-xs text-ink-40">{copy.log.buildMealEmptyBody}</p>
               </div>
             )}
          </>
        )}
      </div>

      {/* Serving picker for ingredient tab */}
      {pendingIngredient && (
        <ServingPicker
          defaultG={pendingIngredient.common_serving_g}
          defaultLabel={pendingIngredient.common_serving_label}
          onConfirm={(g) => logIngredient(pendingIngredient, g)}
          onCancel={() => setPendingIngredient(null)}
        />
      )}

      {/* Serving picker for OFF item */}
      {pendingOff && (
        <ServingPicker
          defaultG={100}
          defaultLabel="100 g"
          onConfirm={(g) => logOff(pendingOff, g)}
          onCancel={() => setPendingOff(null)}
        />
      )}

      {/* Serving picker for build-a-meal */}
      {buildPendingIngredient && (
        <ServingPicker
          defaultG={buildPendingIngredient.common_serving_g}
          defaultLabel={buildPendingIngredient.common_serving_label}
          onConfirm={(g) => {
            setBuildItems((prev) => [...prev, { ingredient: buildPendingIngredient, serving_g: g }]);
            setBuildPendingIngredient(null);
            setQuery('');
          }}
          onCancel={() => setBuildPendingIngredient(null)}
        />
      )}

      {nutritionSheet && (
        <NutritionDetailSheet
          title={nutritionSheet.title}
          subtitle={nutritionSheet.subtitle}
          nutritionPer100g={nutritionSheet.nutritionPer100g}
          servingG={nutritionSheet.servingG}
          servingLabel={nutritionSheet.servingLabel}
          onClose={() => setNutritionSheet(null)}
        />
      )}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function IngredientRow({
  ingredient,
  mode,
  language,
  onAdd,
  onView,
  actionLabel = '+',
}: {
  ingredient: Ingredient;
  mode: 'pcos' | 'bulk' | 'maintain';
  language: 'en' | 'he';
  onAdd: () => void;
  onView: () => void;
  actionLabel?: string;
}) {
  const { copy, language: currentLanguage } = useI18n();
  const score = mode === 'pcos' ? ingredient.pcos_score : ingredient.bulk_score;
  const primaryName = language === 'he' ? (ingredient.nameHe ?? ingredient.name) : ingredient.name;
  const secondaryName = language === 'he' && ingredient.nameHe ? ingredient.name : ingredient.nameHe;

  return (
    <div className="bg-cream-card border border-sand rounded-2xl p-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-plum-dark">{primaryName}</span>
          {secondaryName && (
            <span className="text-xs text-ink-40">{secondaryName}</span>
          )}
          <ScoreBadge score={score} size="sm" />
        </div>
        <div className="text-xs text-ink-40 mt-0.5 flex gap-2 flex-wrap">
          <span>{rowSummary(ingredientToNutrition(ingredient))}</span>
        </div>
        <button
          type="button"
          onClick={onView}
          className="mt-1 text-xs font-medium text-sage-deep"
          data-testid={`ingredient-detail-btn-${ingredient.id}`}
        >
          {copy.log.fullNutrition}
        </button>
        {ingredient.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {ingredient.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] bg-sand text-ink-60 rounded-full px-2 py-0.5">{t}</span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onAdd}
        data-testid="ingredient-add-btn"
        className="tap-target w-10 h-10 rounded-full bg-coral-accent text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
      >
        {actionLabel === '+' ? <Plus size={18} /> : <ChevronRight size={16} className={directionalIconClass(currentLanguage)} />}
      </button>
    </div>
  );
}

function OFFRow({
  item,
  onAdd,
  onView,
}: {
  item: { id: string; name: string; nutrition: NutritionData };
  onAdd: () => void;
  onView: () => void;
}) {
  const { copy } = useI18n();
  return (
    <div className="bg-cream-card border border-sand rounded-2xl p-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-plum-dark truncate">{item.name}</p>
        <div className="text-xs text-ink-40 mt-0.5">{rowSummary(item.nutrition)}</div>
        <button type="button" onClick={onView} className="mt-1 text-xs font-medium text-sage-deep">
          {copy.log.fullNutrition}
        </button>
      </div>
      <button
        onClick={onAdd}
        className="tap-target w-10 h-10 rounded-full bg-coral-accent text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function MealRow({
  meal,
  profile,
  onView,
  onLog,
  loggedId,
}: {
  meal: MealItem;
  profile: NonNullable<ReturnType<typeof selectActiveProfile>>;
  onView: () => void;
  onLog: (m: MealItem) => void;
  loggedId: string | null;
}) {
  const { copy, language } = useI18n();
  const score = profile.mode === 'pcos' ? meal.pcos_score : (meal.bulk_score ?? meal.pcos_score);
  const isLogged = loggedId === meal.id;

  return (
    <div className="bg-cream-card border border-sand rounded-2xl p-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
           <span className="text-sm font-medium text-plum-dark">{mealDisplayName(meal, language)}</span>
          <ScoreBadge score={score} size="sm" />
        </div>
        <div className="text-xs text-ink-40 mt-0.5 flex gap-2">
           <span>{formatAmountWithUnit(meal.nutrition.calories, copy.common.kcal, language)}</span>
           <span>·</span>
           <span>{formatAmountWithUnit(meal.nutrition.protein_g, `g ${copy.common.protein}`, language, 1)}</span>
           <span>·</span>
           <span>{formatAmountWithUnit(meal.prep_time_min, language === 'he' ? 'דק׳' : 'min', language)}</span>
         </div>
        <button
          type="button"
          onClick={onView}
          className="mt-1 text-xs font-medium text-sage-deep"
          data-testid={`meal-detail-btn-${meal.id}`}
        >
           {copy.log.fullNutrition}
         </button>
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
        className={`tap-target w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          isLogged ? 'bg-moss text-white scale-95' : 'bg-coral-accent text-white active:scale-95'
        }`}
      >
        {isLogged ? <Check size={18} /> : <Plus size={18} />}
      </button>
    </div>
  );
}
