import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Zap, FlipHorizontal, Check } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { NutritionData, LoggedMeal } from '../store/appStore';
import { scoreFood } from '../lib/scoring';
import { getCurrentPhase } from '../lib/cyclePhase';
import { fetchByBarcode } from '../lib/openFoodFacts';

type ScanMode = 'barcode' | 'photo' | 'manual';
type MealType = LoggedMeal['meal_type'];

interface ScannedProduct {
  name: string;
  image?: string;
  nutrition: NutritionData;
  ingredients?: string[];
}

const QUICK_INGREDIENTS = [
  { label: 'Rice', nutrition: { calories: 130, protein_g: 2.7, carbs_g: 28, fiber_g: 0.4, sugar_g: 0, fat_g: 0.3, saturated_fat_g: 0, sodium_mg: 1 } },
  { label: 'Chicken', nutrition: { calories: 165, protein_g: 31, carbs_g: 0, fiber_g: 0, sugar_g: 0, fat_g: 3.6, saturated_fat_g: 1, sodium_mg: 74 } },
  { label: 'Salmon', nutrition: { calories: 208, protein_g: 20, carbs_g: 0, fiber_g: 0, sugar_g: 0, fat_g: 13, saturated_fat_g: 3, sodium_mg: 59, omega3_g: 2.2 } },
  { label: 'Avocado', nutrition: { calories: 160, protein_g: 2, carbs_g: 9, fiber_g: 7, sugar_g: 0.7, fat_g: 15, saturated_fat_g: 2, sodium_mg: 7 } },
  { label: 'Eggs', nutrition: { calories: 155, protein_g: 13, carbs_g: 1.1, fiber_g: 0, sugar_g: 1.1, fat_g: 11, saturated_fat_g: 3, sodium_mg: 124 } },
  { label: 'Lentils', nutrition: { calories: 116, protein_g: 9, carbs_g: 20, fiber_g: 8, sugar_g: 1.8, fat_g: 0.4, saturated_fat_g: 0, sodium_mg: 2 } },
  { label: 'Quinoa', nutrition: { calories: 120, protein_g: 4.4, carbs_g: 21, fiber_g: 2.8, sugar_g: 0.9, fat_g: 1.9, saturated_fat_g: 0, sodium_mg: 7 } },
  { label: 'Greek Yogurt', nutrition: { calories: 59, protein_g: 10, carbs_g: 3.6, fiber_g: 0, sugar_g: 3.6, fat_g: 0.4, saturated_fat_g: 0, sodium_mg: 36 } },
];

export default function Scanner() {
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const logMeal = useAppStore((s) => s.logMeal);

  const [mode, setMode] = useState<ScanMode>('barcode');
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servingG, setServingG] = useState(100);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [manualQuery, setManualQuery] = useState('');
  const [logged, setLogged] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (mode === 'barcode' && !product) {
      startScanner(facingMode);
    }
    return () => {
      stopScanner();
    };
  }, [mode]);

  async function flipCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await stopScanner();
    startScanner(next);
  }

  async function startScanner(facing: 'environment' | 'user' = 'environment') {
    try {
      setScanning(true);
      setError(null);
      const html5Qrcode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5Qrcode;
      await html5Qrcode.start(
        { facingMode: facing },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        async (barcode) => {
          await stopScanner();
          await lookupBarcode(barcode);
        },
        () => {}
      );
    } catch {
      setScanning(false);
      setError('Camera access denied. Please allow camera permission and try again.');
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function lookupBarcode(barcode: string) {
    setLoading(true);
    const result = await fetchByBarcode(barcode);
    setLoading(false);
    if (result) {
      setProduct(result);
    } else {
      setError(`Product not found for barcode ${barcode}. Try manual entry.`);
    }
  }

  function handleLogMeal() {
    if (!profile || !product) return;
    const factor = servingG / 100;
    const nutrition: NutritionData = {
      calories: Math.round(product.nutrition.calories * factor),
      protein_g: Math.round(product.nutrition.protein_g * factor * 10) / 10,
      carbs_g: Math.round(product.nutrition.carbs_g * factor * 10) / 10,
      fiber_g: Math.round(product.nutrition.fiber_g * factor * 10) / 10,
      sugar_g: Math.round(product.nutrition.sugar_g * factor * 10) / 10,
      fat_g: Math.round(product.nutrition.fat_g * factor * 10) / 10,
      saturated_fat_g: Math.round(product.nutrition.saturated_fat_g * factor * 10) / 10,
      sodium_mg: Math.round(product.nutrition.sodium_mg * factor),
      glycemic_index: product.nutrition.glycemic_index,
      glycemic_load: product.nutrition.glycemic_load ? Math.round(product.nutrition.glycemic_load * factor) : undefined,
      omega3_g: product.nutrition.omega3_g ? Math.round(product.nutrition.omega3_g * factor * 10) / 10 : undefined,
      ingredients: product.ingredients,
    };

    const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;
    const score = scoreFood(nutrition, servingG, profile.mode, phaseInfo?.phase);

    const meal: LoggedMeal = {
      id: `scan-${Date.now()}`,
      timestamp: new Date().toISOString(),
      meal_type: mealType,
      name: product.name,
      serving_g: servingG,
      nutrition,
      score,
      cyclePhase: phaseInfo?.phase,
    };

    logMeal(profile.id, meal);
    setLogged(true);
    setTimeout(() => navigate('/'), 1200);
  }

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-plum-dark flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Looking up product…</p>
        </div>
      </div>
    );
  }

  if (logged) {
    return (
      <div className="fixed inset-0 bg-moss flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-white" />
          </div>
          <p className="text-lg font-semibold">Meal logged!</p>
        </div>
      </div>
    );
  }

  // Product result screen
  if (product) {
    const factor = servingG / 100;
    const kcal = Math.round(product.nutrition.calories * factor);
    const phaseInfo = profile?.mode === 'pcos' ? getCurrentPhase(profile!) : null;
    const score = profile ? scoreFood(
      { ...product.nutrition, calories: kcal },
      servingG,
      profile.mode,
      phaseInfo?.phase
    ) : 5;

    return (
      <div className="min-h-screen bg-cream-bg overflow-y-auto pb-8">
        <div className="sticky top-0 z-10 bg-cream-bg px-4 py-3 flex items-center gap-3 border-b border-sand">
          <button onClick={() => { setProduct(null); startScanner(facingMode); }} className="p-2 rounded-full hover:bg-sand">
            <X size={20} className="text-plum-dark" />
          </button>
          <h1 className="font-semibold text-plum-dark">Scan result</h1>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {product.image && (
            <div className="rounded-2xl overflow-hidden h-44 bg-sand">
              <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold text-plum-dark">{product.name}</h2>
          </div>

          {/* Score card */}
          <div className="bg-cream-card rounded-2xl p-4 border border-sand">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-plum-dark">
                {profile?.mode === 'bulk' ? 'Bulk Score' : 'PCOS Score'}
              </span>
              <span className="text-2xl font-bold font-display" style={{ color: score >= 8.5 ? '#3F5D3C' : score >= 7 ? '#5C7A58' : '#E8B84F' }}>
                {score.toFixed(1)} / 10
              </span>
            </div>
            <div className="h-2 bg-sand rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${score * 10}%`, backgroundColor: score >= 8.5 ? '#3F5D3C' : score >= 7 ? '#5C7A58' : '#E8B84F' }} />
            </div>
          </div>

          {/* Nutrition */}
          <div className="bg-cream-card rounded-2xl p-4 border border-sand">
            <h3 className="text-sm font-semibold text-plum-dark mb-3">Nutrition per {servingG}g</h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              {[
                { label: 'Calories', val: `${kcal} kcal` },
                { label: 'Protein', val: `${(product.nutrition.protein_g * factor).toFixed(1)}g` },
                { label: 'Carbs', val: `${(product.nutrition.carbs_g * factor).toFixed(1)}g` },
                { label: 'Fiber', val: `${(product.nutrition.fiber_g * factor).toFixed(1)}g` },
                { label: 'Fat', val: `${(product.nutrition.fat_g * factor).toFixed(1)}g` },
                { label: 'Sugar', val: `${(product.nutrition.sugar_g * factor).toFixed(1)}g` },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-ink-60">{label}</span>
                  <span className="font-medium text-plum-dark font-mono-num">{val}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-sand">
              <label className="text-xs text-ink-60 block mb-2">Serving size (g)</label>
              <input
                type="number"
                value={servingG}
                onChange={(e) => setServingG(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-sand bg-cream-bg text-sm font-mono-num"
              />
            </div>
          </div>

          {/* Meal type */}
          <div className="bg-cream-card rounded-2xl p-4 border border-sand">
            <h3 className="text-sm font-semibold text-plum-dark mb-3">Meal type</h3>
            <div className="flex flex-wrap gap-2">
              {mealTypes.map((mt) => (
                <button
                  key={mt}
                  onClick={() => setMealType(mt)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                    mealType === mt
                      ? 'bg-sage-deep text-white'
                      : 'bg-sand text-ink-60'
                  }`}
                >
                  {mt.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleLogMeal}
            className="w-full bg-coral-accent text-white rounded-2xl py-4 font-semibold text-base active:scale-95 transition-transform"
          >
            Log This Meal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 z-10">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <X size={20} className="text-white" />
        </button>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </button>
          <button
            onClick={flipCamera}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <FlipHorizontal size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Camera / content */}
      <div className="flex-1 relative">
        {mode === 'barcode' && (
          <div id="qr-reader" className="absolute inset-0" />
        )}

        {mode === 'manual' && (
          <div className="h-full flex flex-col items-center justify-center px-6 gap-4">
            <input
              autoFocus
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="Search for a food…"
              className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white placeholder-white/50 text-base border border-white/20 focus:outline-none focus:border-white/40"
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/log?q=${encodeURIComponent(manualQuery)}`)}
            />
            <button
              onClick={() => navigate(`/log?q=${encodeURIComponent(manualQuery)}`)}
              className="w-full bg-coral-accent text-white py-3 rounded-2xl font-semibold"
            >
              Search
            </button>
          </div>
        )}

        {mode === 'photo' && (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <p className="text-white text-center text-sm mb-6 opacity-70">
              Tap ingredients in your meal to log them
            </p>
            <div className="grid grid-cols-4 gap-2 w-full">
              {QUICK_INGREDIENTS.map((ing) => (
                <button
                  key={ing.label}
                  onClick={() => setSelectedIngredients((prev) =>
                    prev.includes(ing.label) ? prev.filter((i) => i !== ing.label) : [...prev, ing.label]
                  )}
                  className={`py-2.5 rounded-xl text-xs font-medium transition-all ${
                    selectedIngredients.includes(ing.label)
                      ? 'bg-sage-primary text-white scale-95'
                      : 'bg-white/10 text-white/80'
                  }`}
                >
                  {ing.label}
                </button>
              ))}
            </div>
            {selectedIngredients.length > 0 && (
              <button
                onClick={() => {
                  const combined = QUICK_INGREDIENTS
                    .filter((i) => selectedIngredients.includes(i.label))
                    .reduce((acc, i) => ({
                      ...acc,
                      calories: acc.calories + i.nutrition.calories,
                      protein_g: acc.protein_g + i.nutrition.protein_g,
                      carbs_g: acc.carbs_g + i.nutrition.carbs_g,
                      fiber_g: acc.fiber_g + i.nutrition.fiber_g,
                      sugar_g: acc.sugar_g + i.nutrition.sugar_g,
                      fat_g: acc.fat_g + i.nutrition.fat_g,
                      saturated_fat_g: acc.saturated_fat_g + i.nutrition.saturated_fat_g,
                      sodium_mg: acc.sodium_mg + i.nutrition.sodium_mg,
                    }), { calories: 0, protein_g: 0, carbs_g: 0, fiber_g: 0, sugar_g: 0, fat_g: 0, saturated_fat_g: 0, sodium_mg: 0 });
                  setProduct({ name: selectedIngredients.join(' + '), nutrition: combined as NutritionData });
                }}
                className="mt-6 w-full bg-coral-accent text-white py-3 rounded-2xl font-semibold"
              >
                Done — {selectedIngredients.length} ingredient{selectedIngredients.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {mode === 'barcode' && !scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border-2 border-white/60 rounded-xl w-64 h-32 flex items-center justify-center">
              <p className="text-white/60 text-xs">scanning…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center gap-4">
            <p className="text-white/80 text-sm">{error}</p>
            <button onClick={() => { setError(null); setMode('manual'); }} className="bg-coral-accent text-white px-5 py-2.5 rounded-xl text-sm font-medium">
              Try manual entry
            </button>
          </div>
        )}
      </div>

      {/* Mode selector */}
      <div className="px-5 pb-8 pt-4">
        <div className="bg-white/10 rounded-2xl p-1 flex">
          {(['barcode', 'photo', 'manual'] as ScanMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                mode === m ? 'bg-white text-plum-dark shadow-sm' : 'text-white/70'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
