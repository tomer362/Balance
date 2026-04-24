import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Plus, User } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { LoggedMeal, Profile as ProfileType } from '../store/appStore';
import { computePCOSTargets, computeBulkTargets } from '../lib/targetComputation';
import { getCurrentPhase } from '../lib/cyclePhase';

const CONCERNS = ['Insulin resistance', 'Weight', 'Hirsutism', 'Acne', 'Fertility', 'Irregular cycles'];
const DIETARY_FLAGS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-limited', 'Nut-free'];
const SUPPLEMENTS = ['Creatine 5g daily', 'Whey protein', 'Fish oil', 'Vitamin D', 'Inositol'];

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Profile() {
  const navigate = useNavigate();
  const activeId = useAppStore((s) => s.activeProfileId);
  const profiles = useAppStore((s) => s.profiles);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const addProfile = useAppStore((s) => s.addProfile);
  const profile = useAppStore(selectActiveProfile);

  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileMode, setNewProfileMode] = useState<'pcos' | 'bulk' | 'maintain'>('maintain');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  if (!profile) return null;

  const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;
  const computedTargets = profile.mode === 'pcos' ? computePCOSTargets(profile) : computeBulkTargets(profile);

  function toggleConcern(concern: string) {
    if (!profile?.pcos) return;
    const key = concern.toLowerCase().replace(/\s/g, '-');
    const current = profile.pcos.concerns;
    updateProfile(profile.id, {
      pcos: {
        ...profile.pcos,
        concerns: current.includes(key)
          ? current.filter((c) => c !== key)
          : [...current, key],
      },
    });
  }

  function toggleFlag(flag: string) {
    const p = profile!;
    const key = flag.toLowerCase().replace(/\s/g, '-');
    const current = p.preferences.dietary_flags;
    updateProfile(p.id, {
      preferences: {
        ...p.preferences,
        dietary_flags: current.includes(key)
          ? current.filter((f) => f !== key)
          : [...current, key],
      },
    });
  }

  function toggleTrainingDay(dayIdx: number) {
    if (!profile?.bulk?.trainingSchedule) return;
    const pattern = [...profile.bulk.trainingSchedule.weekPattern];
    pattern[dayIdx] = pattern[dayIdx] === 'training' ? 'rest' : 'training';
    updateProfile(profile.id, {
      bulk: {
        ...profile.bulk,
        trainingSchedule: { ...profile.bulk.trainingSchedule, weekPattern: pattern },
      },
    });
  }

  function toggleSupplement(supp: string) {
    if (!profile?.bulk) return;
    const key = supp.toLowerCase().replace(/\s/g, '-').replace(/\d/g, '').trim();
    const current = profile.bulk.supplements;
    updateProfile(profile.id, {
      bulk: {
        ...profile.bulk,
        supplements: current.includes(key)
          ? current.filter((s) => s !== key)
          : [...current, key],
      },
    });
  }

  function exportToCSV() {
    const headers = ['date', 'meal_type', 'name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'score'];
    const rows = profile.foodLog.map((m) => [
      m.timestamp.split('T')[0],
      m.meal_type,
      `"${m.name.replace(/"/g, '""')}"`,
      m.nutrition.calories,
      m.nutrition.protein_g,
      m.nutrition.carbs_g,
      m.nutrition.fat_g,
      m.nutrition.fiber_g,
      m.nutrition.sugar_g,
      m.nutrition.sodium_mg,
      m.score.toFixed(1),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = (ev.target?.result as string).trim();
        const lines = text.split('\n').filter(Boolean);
        if (lines.length < 2) throw new Error('File appears empty');
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const idx = (key: string) => headers.indexOf(key);
        const nameI = idx('name');
        const calI = idx('calories');
        const protI = idx('protein_g');
        const carbI = idx('carbs_g');
        const fatI = idx('fat_g');
        const fiberI = idx('fiber_g');
        const sugarI = idx('sugar_g');
        const sodI = idx('sodium_mg');
        const typeI = idx('meal_type');
        const dateI = idx('date');
        if (nameI === -1 || calI === -1) throw new Error('Missing required columns: name, calories');
        const newMeals: LoggedMeal[] = lines.slice(1).map((line) => {
          const cols = line.split(',');
          const name = (cols[nameI] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          const dateStr = cols[dateI]?.trim() ?? new Date().toISOString().split('T')[0];
          return {
            id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: `${dateStr}T12:00:00.000Z`,
            meal_type: (cols[typeI]?.trim() as LoggedMeal['meal_type']) || 'lunch',
            name: name || 'Imported meal',
            serving_g: 100,
            nutrition: {
              calories: parseFloat(cols[calI]) || 0,
              protein_g: parseFloat(cols[protI]) || 0,
              carbs_g: parseFloat(cols[carbI]) || 0,
              fat_g: parseFloat(cols[fatI]) || 0,
              fiber_g: parseFloat(cols[fiberI]) || 0,
              sugar_g: parseFloat(cols[sugarI]) || 0,
              saturated_fat_g: 0,
              sodium_mg: parseFloat(cols[sodI]) || 0,
            },
            score: 5,
          };
        });
        updateProfile(profile.id, { foodLog: [...profile.foodLog, ...newMeals] });
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleAddProfile() {
    if (!newProfileName.trim()) return;
    const id = `profile-${Date.now()}`;
    const newProfile: ProfileType = {
      id,
      name: newProfileName.trim(),
      mode: newProfileMode,
      demographics: {
        sex: newProfileMode === 'pcos' ? 'female' : 'male',
        age: 25,
        height_cm: 170,
        weight_kg: 70,
        goal_weight_kg: 70,
        activity_level: 'moderate',
      },
      targets: {
        calories: 2000,
        protein_g: 120,
        fat_g: 65,
        carbs_g: 220,
        fiber_g: 30,
        omega3_g: 2,
      },
      foodLog: [],
      mealPlan: {},
      weightHistory: [{ date: new Date().toISOString().split('T')[0], kg: 70 }],
      customRecipes: [],
      preferences: { dietary_flags: [], dislikes: [] },
      ...(newProfileMode === 'pcos' ? {
        pcos: {
          concerns: [],
          cycle: { avgCycleLength: 28, avgPeriodLength: 5, history: [] },
          symptomLog: [],
          seedCyclingEnabled: false,
        },
      } : {}),
      ...(newProfileMode === 'bulk' ? {
        bulk: {
          surplus_kcal: 300,
          protein_g_per_kg: 2.0,
          trainingSchedule: {
            weekPattern: ['training', 'rest', 'training', 'rest', 'training', 'training', 'rest'],
          },
          supplements: [],
        },
      } : {}),
    };
    addProfile(newProfile);
    setActiveProfile(id);
    setNewProfileName('');
    setShowAddProfile(false);
    setShowProfileSwitcher(false);
  }

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sand">
          <ArrowLeft size={20} className="text-plum-dark" />
        </button>
        <h1 className="font-semibold text-plum-dark">Profile</h1>
      </div>

      <div className="px-4 space-y-4 pb-6">
        {/* Profile card */}
        <button
          onClick={() => setShowProfileSwitcher(!showProfileSwitcher)}
          className="w-full bg-cream-card rounded-2xl border border-sand p-4 flex items-center gap-3 text-left"
        >
          <div className="w-12 h-12 rounded-full bg-sage-primary/20 flex items-center justify-center text-lg flex-shrink-0">
            {profile.avatar ?? <User size={24} className="text-sage-deep" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-plum-dark">{profile.name}</p>
            <p className="text-xs text-ink-60">
              {profile.mode === 'pcos' ? 'PCOS Mode' : profile.mode === 'bulk' ? 'Bulk Mode' : 'Maintain'}
              {phaseInfo && ` · cycle day ${phaseInfo.cycleDay}`}
              {profile.mode === 'bulk' && ` · ${profile.demographics.weight_kg} kg`}
            </p>
            <p className="text-xs text-ink-40">{profile.demographics.weight_kg} kg → {profile.demographics.goal_weight_kg} kg goal</p>
          </div>
          <ChevronRight size={18} className="text-ink-40 flex-shrink-0" />
        </button>

        {/* Profile switcher */}
        {showProfileSwitcher && (
          <div className="bg-cream-card rounded-2xl border border-sand overflow-hidden">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => { setActiveProfile(p.id); setShowProfileSwitcher(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  p.id === activeId ? 'bg-sage-primary/10' : 'hover:bg-sand/50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-sage-primary/20 flex items-center justify-center text-sm flex-shrink-0">
                  {p.avatar ?? '👤'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-plum-dark">{p.name}</p>
                  <p className="text-xs text-ink-40 capitalize">{p.mode} Mode</p>
                </div>
                {p.id === activeId && <span className="text-xs text-sage-deep font-medium">(active)</span>}
              </button>
            ))}
            <button
              onClick={() => { setShowAddProfile(true); setShowProfileSwitcher(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-coral-accent font-medium border-t border-sand"
            >
              <Plus size={16} />
              Add profile
            </button>
          </div>
        )}

        {/* Add profile form */}
        {showAddProfile && (
          <div className="bg-cream-card rounded-2xl border border-coral-accent/30 p-4 space-y-3">
            <p className="text-xs font-bold text-ink-40 uppercase tracking-wide">New profile</p>
            <input
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Name"
              className="w-full px-3 py-2 rounded-xl border border-sand text-sm bg-cream-bg focus:outline-none"
            />
            <div className="flex gap-2">
              {(['pcos', 'bulk', 'maintain'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setNewProfileMode(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all capitalize ${
                    newProfileMode === m ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'
                  }`}
                >
                  {m === 'pcos' ? 'PCOS' : m === 'bulk' ? 'Bulk' : 'Maintain'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddProfile(false); setNewProfileName(''); }}
                className="flex-1 py-2 rounded-xl border border-sand text-sm text-ink-60"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProfile}
                disabled={!newProfileName.trim()}
                className="flex-1 py-2 rounded-xl bg-coral-accent text-white text-sm font-semibold disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {/* Mode */}
        <Section title="Mode">
          <div className="space-y-2">
            {(['pcos', 'bulk', 'maintain'] as const).map((m) => (
              <button
                key={m}
                onClick={() => updateProfile(profile.id, { mode: m })}
                className="w-full flex items-center gap-3 py-1"
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  profile.mode === m ? 'border-sage-deep' : 'border-sand'
                }`}>
                  {profile.mode === m && <div className="w-2 h-2 rounded-full bg-sage-deep" />}
                </div>
                <span className="text-sm text-plum-dark capitalize">
                  {m === 'pcos' ? 'PCOS Mode' : m === 'bulk' ? 'Bulk Mode' : 'Maintain'}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* PCOS-specific */}
        {profile.mode === 'pcos' && profile.pcos && (
          <Section title="PCOS Profile">
            <p className="text-xs text-ink-40 mb-2">Primary concerns</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {CONCERNS.map((c) => {
                const key = c.toLowerCase().replace(/\s/g, '-');
                const active = profile.pcos!.concerns.includes(key);
                return (
                  <button
                    key={c}
                    onClick={() => toggleConcern(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      active ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'
                    }`}
                  >
                    {active ? '✓ ' : ''}{c}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between py-2 border-t border-sand">
              <span className="text-sm text-plum-dark">Phase-aware suggestions</span>
              <Toggle
                checked={true}
                onChange={() => {}}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-plum-dark">Seed cycling reminders</span>
              <Toggle
                checked={profile.pcos.seedCyclingEnabled}
                onChange={() => updateProfile(profile.id, {
                  pcos: { ...profile.pcos!, seedCyclingEnabled: !profile.pcos!.seedCyclingEnabled }
                })}
              />
            </div>
          </Section>
        )}

        {/* Bulk-specific */}
        {profile.mode === 'bulk' && profile.bulk && (
          <Section title="Training schedule">
            <p className="text-xs text-ink-40 mb-2">Tap to toggle training / rest days</p>
            <div className="flex gap-2 mb-3">
              {DAYS_SHORT.map((day, i) => {
                const isTrain = profile.bulk!.trainingSchedule.weekPattern[i] === 'training';
                const split = profile.bulk!.trainingSchedule.split?.[i];
                return (
                  <button
                    key={i}
                    onClick={() => toggleTrainingDay(i)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      isTrain ? 'bg-sage-deep text-white' : 'bg-sand text-ink-40'
                    }`}
                  >
                    <div>{day}</div>
                    {split && split !== 'Rest' && <div className="text-[9px] mt-0.5 opacity-70">{split}</div>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between py-2 border-t border-sand">
              <span className="text-sm text-ink-60">Calorie surplus</span>
              <span className="text-sm font-semibold text-plum-dark font-mono-num">+{profile.bulk.surplus_kcal} kcal</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-ink-60">Protein target</span>
              <span className="text-sm font-semibold text-plum-dark font-mono-num">{profile.bulk.protein_g_per_kg} g/kg</span>
            </div>

            <p className="text-xs text-ink-40 mt-3 mb-2">Supplements</p>
            <div className="space-y-1.5">
              {SUPPLEMENTS.map((s) => {
                const key = s.toLowerCase().split(' ').slice(0, 1).join('');
                const active = profile.bulk!.supplements.some((sup) => sup.includes(key));
                return (
                  <button
                    key={s}
                    onClick={() => toggleSupplement(s)}
                    className="w-full flex items-center gap-3 py-1"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      active ? 'border-sage-deep bg-sage-deep' : 'border-sand'
                    }`}>
                      {active && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <span className="text-sm text-plum-dark">{s}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Daily targets */}
        <Section title="Daily targets (auto-computed)">
          <div className="space-y-2">
            {[
              { label: 'Calories', val: `${computedTargets.calories} kcal` },
              { label: 'Protein', val: `${computedTargets.protein_g}g` },
              { label: 'Carbs', val: `${computedTargets.carbs_g}g` },
              { label: 'Fat', val: `${computedTargets.fat_g}g` },
              ...(profile.mode === 'pcos' ? [
                { label: 'Fiber', val: `${computedTargets.fiber_g}g` },
                { label: 'Omega-3', val: `${computedTargets.omega3_g}g` },
                { label: 'Max GL/day', val: String(computedTargets.max_glycemic_load) },
              ] : [
                { label: 'Training day calories', val: `${computedTargets.calories_training_day} kcal` },
                { label: 'Rest day calories', val: `${computedTargets.calories_rest_day} kcal` },
              ]),
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-ink-60">{label}</span>
                <span className="text-sm font-semibold text-plum-dark font-mono-num">{val}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Dietary preferences */}
        <Section title="Dietary preferences">
          <div className="flex flex-wrap gap-2">
            {DIETARY_FLAGS.map((f) => {
              const key = f.toLowerCase().replace(/\s/g, '-');
              const active = profile.preferences.dietary_flags.includes(key);
              return (
                <button
                  key={f}
                  onClick={() => toggleFlag(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    active ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'
                  }`}
                >
                  {active ? '✓ ' : ''}{f}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Household */}
        <Section title="Household">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProfile(p.id)}
              className="w-full flex items-center gap-3 py-1.5 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-sage-primary/20 flex items-center justify-center text-sm">👤</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-plum-dark">{p.name}</p>
                <p className="text-xs text-ink-40 capitalize">{p.mode} Mode</p>
              </div>
              {p.id === activeId && <span className="text-xs text-sage-deep font-medium">(you)</span>}
            </button>
          ))}
          <button
            onClick={() => setShowAddProfile(true)}
            className="flex items-center gap-2 mt-2 text-sm text-coral-accent font-medium"
          >
            <Plus size={15} /> Add profile
          </button>
        </Section>

        {/* Data */}
        <Section title="Data">
          <div className="space-y-3">
            <button onClick={exportToCSV} className="w-full text-left text-sm text-ink-60 py-1">
              Export to CSV ({profile.foodLog.length} meals)
            </button>
            <label className="w-full text-left text-sm text-ink-60 py-1 cursor-pointer block">
              Import from CSV
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportCSV}
              />
            </label>
            {importError && <p className="text-xs text-terracotta">{importError}</p>}
            {importSuccess && <p className="text-xs text-moss">Import successful!</p>}
            <button
              className="w-full text-left text-sm text-terracotta py-1"
              onClick={() => {
                if (confirm('Reset all your data? This cannot be undone.')) {
                  updateProfile(profile.id, { foodLog: [], weightHistory: [], mealPlan: {} });
                }
              }}
            >
              Reset all data
            </button>
          </div>
        </Section>

        {/* About */}
        <div className="text-center text-xs text-ink-40 py-2">
          Balance v1.0.0 · Goal-aware nutrition tracking
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-cream-card rounded-2xl border border-sand p-4">
      <h2 className="text-xs font-bold text-ink-40 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-10 h-6 rounded-full transition-colors relative ${checked ? 'bg-sage-deep' : 'bg-sand'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
