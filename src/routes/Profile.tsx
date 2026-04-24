import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Plus, User, Trash2, X, Download, Upload, Info } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import type { Profile } from '../store/appStore';
import { computePCOSTargets, computeBulkTargets, computeMaintainTargets } from '../lib/targetComputation';
import { getCurrentPhase } from '../lib/cyclePhase';

const CONCERNS = ['Insulin resistance', 'Weight', 'Hirsutism', 'Acne', 'Fertility', 'Irregular cycles'];
const DIETARY_FLAGS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-limited', 'Nut-free'];
const SUPPLEMENTS = ['Creatine 5g daily', 'Whey protein', 'Fish oil', 'Vitamin D', 'Inositol'];
const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function exportCSV(profile: Profile): void {
  const headers = [
    'date', 'meal_name', 'meal_type', 'serving_g', 'calories',
    'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'score',
  ];
  const rows = profile.foodLog.map((m) => [
    m.timestamp.split('T')[0],
    `"${m.name.replace(/"/g, '""')}"`,
    m.meal_type,
    m.serving_g,
    m.nutrition.calories,
    m.nutrition.protein_g,
    m.nutrition.carbs_g,
    m.nutrition.fat_g,
    m.nutrition.fiber_g,
    m.score.toFixed(1),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `balance-${profile.name.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Add-profile mini modal ───────────────────────────────────────────────────

function AddProfileModal({ onClose }: { onClose: () => void }) {
  const addProfile = useAppStore((s) => s.addProfile);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<Profile['mode']>('maintain');

  function create() {
    const id = `user-${Date.now()}`;
    const draft: Profile = {
      id,
      name: name.trim() || 'New Profile',
      mode,
      demographics: { sex: 'other', age: 25, height_cm: 170, weight_kg: 70, goal_weight_kg: 70, activity_level: 'moderate' },
      targets: { calories: 2000, protein_g: 100, fat_g: 65, carbs_g: 250 }, // overwritten below
      foodLog: [],
      mealPlan: {},
      weightHistory: [{ date: new Date().toISOString().split('T')[0], kg: 70 }],
      customRecipes: [],
      preferences: { dietary_flags: [], dislikes: [] },
      ...(mode === 'pcos'
        ? { pcos: { concerns: [], goal: 'lose_weight' as const, cycle: { avgCycleLength: 28, avgPeriodLength: 5, history: [] }, symptomLog: [], seedCyclingEnabled: false } }
        : mode === 'bulk'
        ? { bulk: { surplus_kcal: 300, protein_g_per_kg: 2.0, trainingSchedule: { weekPattern: ['training', 'rest', 'training', 'rest', 'training', 'training', 'rest'] as Array<'training' | 'rest'> }, supplements: [] } }
        : {}),
    };
    draft.targets =
      mode === 'pcos' ? computePCOSTargets(draft) :
      mode === 'bulk' ? computeBulkTargets(draft) :
      computeMaintainTargets(draft);
    addProfile(draft);
    setActiveProfile(id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-cream-bg rounded-3xl p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-plum-dark">New profile</h3>
          <button onClick={onClose} className="tap-target flex items-center justify-center">
            <X size={20} className="text-ink-40" />
          </button>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full px-4 py-3 rounded-xl border border-sand bg-cream-card text-plum-dark placeholder-ink-40 focus:outline-none focus:border-sage-primary"
        />

        <div className="flex gap-2">
          {(['pcos', 'bulk', 'maintain'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all border ${
                mode === m ? 'bg-sage-deep text-white border-sage-deep' : 'bg-cream-card border-sand text-ink-60'
              }`}
            >
              {m === 'pcos' ? 'PCOS' : m === 'bulk' ? 'Bulk' : 'Maintain'}
            </button>
          ))}
        </div>

        <button
          onClick={create}
          className="w-full bg-sage-deep text-white py-3.5 rounded-2xl font-semibold"
        >
          Create profile
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Profile() {
  const navigate = useNavigate();
  const activeId = useAppStore((s) => s.activeProfileId);
  const profiles = useAppStore((s) => s.profiles);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const deleteProfile = useAppStore((s) => s.deleteProfile);
  const profile = useAppStore(selectActiveProfile);

  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [planInfoMode, setPlanInfoMode] = useState<Profile['mode'] | null>(null);

  if (!profile) return null;

  const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;
  const computedTargets =
    profile.mode === 'pcos'
      ? computePCOSTargets(profile)
      : profile.mode === 'bulk'
      ? computeBulkTargets(profile)
      : computeMaintainTargets(profile);

  /** Switch mode and seed the mode-specific sub-object if it doesn't exist yet */
  function switchMode(m: Profile['mode']) {
    if (!profile) return;
    const updates: Partial<Profile> = { mode: m };
    if (m === 'bulk' && !profile.bulk) {
      updates.bulk = {
        surplus_kcal: 300,
        protein_g_per_kg: 2.0,
        trainingSchedule: {
          weekPattern: ['training', 'rest', 'training', 'rest', 'training', 'training', 'rest'],
        },
        supplements: [],
      };
    }
    if (m === 'pcos' && !profile.pcos) {
      updates.pcos = {
        concerns: [],
        goal: 'lose_weight',
        cycle: { avgCycleLength: 28, avgPeriodLength: 5, history: [] },
        symptomLog: [],
        seedCyclingEnabled: false,
      };
    }
    updateProfile(profile.id, updates);
  }

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
    const key = supp.toLowerCase().split(' ').slice(0, 1).join('');
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

  function handleDeleteProfile(id: string) {
    if (profiles.length <= 1) {
      alert('You need at least one profile.');
      return;
    }
    if (confirm(`Delete profile "${profiles.find((p) => p.id === id)?.name}"? This cannot be undone.`)) {
      deleteProfile(id);
    }
  }

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="tap-target flex items-center justify-center p-2 rounded-full hover:bg-sand">
          <ArrowLeft size={20} className="text-plum-dark" />
        </button>
        <h1 className="font-semibold text-plum-dark">Profile</h1>
      </div>

      <div className="px-4 space-y-4 pb-6">
        {/* Profile card */}
        <button
          data-testid="profile-card"
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
              <div
                key={p.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  p.id === activeId ? 'bg-sage-primary/10' : 'hover:bg-sand/50'
                }`}
              >
                <button
                  onClick={() => { setActiveProfile(p.id); setShowProfileSwitcher(false); }}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-sage-primary/20 flex items-center justify-center text-sm flex-shrink-0">
                    {p.avatar ?? '👤'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-plum-dark">{p.name}</p>
                    <p className="text-xs text-ink-40">{p.mode === 'pcos' ? 'PCOS Mode' : p.mode === 'bulk' ? 'Bulk Mode' : 'Maintain'}</p>
                  </div>
                  {p.id === activeId && <span className="text-xs text-sage-deep font-medium">(active)</span>}
                </button>
                {profiles.length > 1 && (
                  <button
                    onClick={() => handleDeleteProfile(p.id)}
                    className="tap-target flex items-center justify-center text-ink-40 hover:text-terracotta transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => { setShowProfileSwitcher(false); setShowAddModal(true); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-coral-accent font-medium border-t border-sand"
            >
              <Plus size={16} />
              Add profile
            </button>
          </div>
        )}

        {/* Mode */}
        <Section title="Mode">
          <div className="space-y-2">
            {(['pcos', 'bulk', 'maintain'] as const).map((m) => (
              <div key={m} className="flex items-center gap-3 py-1">
                <button
                  data-testid={`mode-${m}`}
                  onClick={() => switchMode(m)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    profile.mode === m ? 'border-sage-deep' : 'border-sand'
                  }`}>
                    {profile.mode === m && <div className="w-2 h-2 rounded-full bg-sage-deep" />}
                  </div>
                  <span className="text-sm text-plum-dark">
                    {m === 'pcos' ? 'PCOS Mode' : m === 'bulk' ? 'Bulk Mode' : 'Maintain'}
                  </span>
                </button>
                <button
                  onClick={() => setPlanInfoMode(m)}
                  className="tap-target flex items-center justify-center text-ink-40 hover:text-sage-deep transition-colors"
                  aria-label={`About ${m} mode`}
                >
                  <Info size={16} />
                </button>
              </div>
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

            {/* PCOS goal selector */}
            <p className="text-xs text-ink-40 mb-2 mt-1">Primary focus</p>
            <div className="flex gap-2 mb-4">
              {([
                { value: 'lose_weight' as const, label: 'Lose weight' },
                { value: 'manage_symptoms' as const, label: 'Manage symptoms' },
              ]).map(({ value, label }) => {
                const active = (profile.pcos!.goal ?? 'lose_weight') === value;
                return (
                  <button
                    key={value}
                    data-testid={`pcos-goal-${value}`}
                    onClick={() => updateProfile(profile.id, {
                      pcos: { ...profile.pcos!, goal: value },
                    })}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      active ? 'bg-sage-deep text-white border-sage-deep' : 'bg-cream-card border-sand text-ink-60'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between py-2 border-t border-sand">
              <span className="text-sm text-plum-dark">Phase-aware suggestions</span>
              <Toggle
                checked={!profile.pcos.cycle.currentPhaseOverride}
                onChange={() =>
                  updateProfile(profile.id, {
                    pcos: {
                      ...profile.pcos!,
                      cycle: {
                        ...profile.pcos!.cycle,
                        currentPhaseOverride: profile.pcos!.cycle.currentPhaseOverride
                          ? undefined
                          : phaseInfo?.phase,
                      },
                    },
                  })
                }
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

        {/* Body metrics — editable */}
        <Section title="Body metrics">
          <div className="space-y-3">
            {/* Sex */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-60">Sex</span>
              <div className="flex gap-1.5">
                {(['female', 'male', 'other'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateProfile(profile.id, { demographics: { ...profile.demographics, sex: s } })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                      profile.demographics.sex === s ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Age */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-60">Age</span>
              <input
                data-testid="metrics-age"
                type="number" min="10" max="120"
                value={profile.demographics.age}
                onChange={(e) => {
                  const v = Math.max(10, Math.min(120, Number(e.target.value)));
                  if (!isNaN(v) && v > 0) updateProfile(profile.id, { demographics: { ...profile.demographics, age: v } });
                }}
                className="w-20 px-2 py-1 rounded-lg border border-sand bg-cream-bg text-sm text-right text-plum-dark font-mono-num focus:outline-none focus:border-sage-primary"
              />
            </div>

            {/* Height */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-60">Height (cm)</span>
              <input
                data-testid="metrics-height"
                type="number" min="100" max="250"
                value={profile.demographics.height_cm}
                onChange={(e) => {
                  const v = Math.max(100, Math.min(250, Number(e.target.value)));
                  if (!isNaN(v) && v > 0) updateProfile(profile.id, { demographics: { ...profile.demographics, height_cm: v } });
                }}
                className="w-20 px-2 py-1 rounded-lg border border-sand bg-cream-bg text-sm text-right text-plum-dark font-mono-num focus:outline-none focus:border-sage-primary"
              />
            </div>

            {/* Weight */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-60">Weight (kg)</span>
              <input
                data-testid="metrics-weight"
                type="number" min="20" max="300" step="0.1"
                value={profile.demographics.weight_kg}
                onChange={(e) => {
                  const v = Math.max(20, Math.min(300, Number(e.target.value)));
                  if (!isNaN(v) && v > 0) updateProfile(profile.id, { demographics: { ...profile.demographics, weight_kg: v } });
                }}
                className="w-20 px-2 py-1 rounded-lg border border-sand bg-cream-bg text-sm text-right text-plum-dark font-mono-num focus:outline-none focus:border-sage-primary"
              />
            </div>

            {/* Goal weight */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-60">Goal weight (kg)</span>
              <input
                data-testid="metrics-goal-weight"
                type="number" min="20" max="300" step="0.1"
                value={profile.demographics.goal_weight_kg}
                onChange={(e) => {
                  const v = Math.max(20, Math.min(300, Number(e.target.value)));
                  if (!isNaN(v) && v > 0) updateProfile(profile.id, { demographics: { ...profile.demographics, goal_weight_kg: v } });
                }}
                className="w-20 px-2 py-1 rounded-lg border border-sand bg-cream-bg text-sm text-right text-plum-dark font-mono-num focus:outline-none focus:border-sage-primary"
              />
            </div>

            {/* Activity level */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-60">Activity level</span>
              <select
                data-testid="metrics-activity"
                value={profile.demographics.activity_level}
                onChange={(e) => updateProfile(profile.id, {
                  demographics: { ...profile.demographics, activity_level: e.target.value as Profile['demographics']['activity_level'] },
                })}
                className="rounded-lg border border-sand bg-cream-bg text-xs text-plum-dark px-2 py-1.5 focus:outline-none focus:border-sage-primary"
              >
                <option value="sedentary">Sedentary</option>
                <option value="light">Lightly active</option>
                <option value="moderate">Moderately active</option>
                <option value="active">Active</option>
                <option value="very_active">Very active</option>
              </select>
            </div>
          </div>
          <p className="text-[10px] text-ink-40 mt-3">All targets recalculate instantly when you update these values.</p>
        </Section>

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
              ] : profile.mode === 'bulk' ? [
                { label: 'Fiber', val: `${computedTargets.fiber_g}g` },
                { label: 'Training day cal', val: `${computedTargets.calories_training_day} kcal` },
                { label: 'Rest day cal', val: `${computedTargets.calories_rest_day} kcal` },
              ] : [
                { label: 'Fiber', val: `${computedTargets.fiber_g}g` },
              ]),
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-ink-60">{label}</span>
                <span className="text-sm font-semibold text-plum-dark font-mono-num">{val}</span>
              </div>
            ))}
          </div>

          {/* TDEE breakdown card */}
          {computedTargets.tdee != null && (
            <div className="mt-4 pt-3 border-t border-sand">
              <p className="text-xs text-ink-40 mb-2">How your calories were calculated</p>
              <div className="bg-sand/50 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-ink-60">TDEE (maintenance)</span>
                  <span className="font-semibold text-plum-dark font-mono-num">{computedTargets.tdee} kcal</span>
                </div>
                {profile.mode === 'pcos' && (
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-60">
                      {(profile.pcos?.goal ?? 'lose_weight') === 'lose_weight'
                        ? 'Deficit (−300 kcal)'
                        : 'Adjustment (symptom management)'}
                    </span>
                    <span className="font-semibold text-plum-dark font-mono-num">
                      {(profile.pcos?.goal ?? 'lose_weight') === 'lose_weight' ? '−300' : '0'} kcal
                    </span>
                  </div>
                )}
                {profile.mode === 'bulk' && (
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-60">Surplus</span>
                    <span className="font-semibold text-plum-dark font-mono-num">+{profile.bulk?.surplus_kcal ?? 300} kcal</span>
                  </div>
                )}
                {profile.mode === 'maintain' && (
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-60">Adjustment</span>
                    <span className="font-semibold text-plum-dark font-mono-num">0 kcal</span>
                  </div>
                )}
                <div className="flex justify-between text-xs border-t border-sand pt-1.5 mt-1">
                  <span className="font-medium text-plum-dark">Daily target</span>
                  <span className="font-bold text-plum-dark font-mono-num">{computedTargets.calories} kcal</span>
                </div>
              </div>
            </div>
          )}
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
            <div key={p.id} className="flex items-center gap-3 py-1.5">
              <div className="w-8 h-8 rounded-full bg-sage-primary/20 flex items-center justify-center text-sm">👤</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-plum-dark">{p.name}</p>
                <p className="text-xs text-ink-40">{p.mode === 'pcos' ? 'PCOS Mode' : p.mode === 'bulk' ? 'Bulk Mode' : 'Maintain'}</p>
              </div>
              {p.id === activeId && <span className="text-xs text-sage-deep font-medium">(you)</span>}
            </div>
          ))}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 mt-2 text-sm text-coral-accent font-medium"
          >
            <Plus size={15} /> Add profile
          </button>
        </Section>

        {/* Data */}
        <Section title="Data">
          <div className="space-y-3">
            <button
              onClick={() => exportCSV(profile)}
              className="w-full text-left text-sm text-ink-60 py-1 flex items-center gap-2"
            >
              <Download size={15} className="text-ink-40" />
              Export food log to CSV
            </button>
            <label className="w-full text-left text-sm text-ink-60 py-1 flex items-center gap-2 cursor-pointer">
              <Upload size={15} className="text-ink-40" />
              Import from CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  alert(`Import from "${file.name}" — parsing not yet implemented. Export your data first and re-import is coming soon.`);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              className="w-full text-left text-sm text-terracotta py-1"
              onClick={() => {
                if (confirm('Reset all food log and weight history for this profile? This cannot be undone.')) {
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

      {/* Add profile modal */}
      {showAddModal && <AddProfileModal onClose={() => setShowAddModal(false)} />}

      {/* Plan info modal */}
      {planInfoMode && (
        <PlanInfoModal
          mode={planInfoMode}
          profile={profile}
          tdee={computedTargets.tdee ?? 2000}
          onClose={() => setPlanInfoMode(null)}
        />
      )}
    </div>
  );
}

// ─── Plan info modal ──────────────────────────────────────────────────────────

function PlanInfoModal({
  mode,
  profile,
  tdee,
  onClose,
}: {
  mode: 'pcos' | 'bulk' | 'maintain';
  profile: Profile;
  tdee: number;
  onClose: () => void;
}) {
  const { weight_kg } = profile.demographics;

  const content = {
    pcos: {
      title: 'PCOS Mode',
      subtitle: 'Supports insulin sensitivity & hormone balance',
      points: [
        `Your maintenance (TDEE): ${tdee} kcal/day`,
        (profile.pcos?.goal ?? 'lose_weight') === 'lose_weight'
          ? `300 kcal deficit → ${Math.max(1200, tdee - 300)} kcal target for gradual fat loss`
          : `No deficit → ${tdee} kcal at maintenance to preserve hormonal balance`,
        `High protein (${Math.round(weight_kg * 1.5)}g / 1.5 g per kg) reduces insulin spikes`,
        'Phase-aware meals align macros with your menstrual cycle',
        'Daily fiber (30g) and omega-3 (3g) targets help reduce inflammation',
      ],
    },
    bulk: {
      title: 'Bulk Mode',
      subtitle: 'Maximizes lean muscle growth',
      points: [
        `Your maintenance (TDEE): ${tdee} kcal/day`,
        `+${profile.bulk?.surplus_kcal ?? 300} kcal surplus → ${tdee + (profile.bulk?.surplus_kcal ?? 300)} kcal/day to fuel muscle growth`,
        `High protein (${Math.round(weight_kg * (profile.bulk?.protein_g_per_kg ?? 2.0))}g / ${profile.bulk?.protein_g_per_kg ?? 2.0} g per kg) maximizes muscle protein synthesis`,
        'Training days: +150 kcal with extra carbs for performance',
        'Rest days: −150 kcal to minimize fat accumulation',
      ],
    },
    maintain: {
      title: 'Maintain Mode',
      subtitle: 'Keeps weight stable with balanced nutrition',
      points: [
        `Your TDEE: ${tdee} kcal/day — this becomes your daily calorie target`,
        'No deficit or surplus — calories match what you burn',
        `Protein target: ${Math.round(weight_kg * 1.2)}g / day (1.2 g per kg — WHO recommendation)`,
        'Balanced macros (30% fat, ~50% carbs) support energy and long-term health',
        'Focus on food quality and consistency rather than restriction',
      ],
    },
  }[mode];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-cream-bg rounded-3xl p-5 space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-plum-dark">{content.title}</h3>
            <p className="text-xs text-ink-40 mt-0.5">{content.subtitle}</p>
          </div>
          <button onClick={onClose} className="tap-target flex items-center justify-center flex-shrink-0">
            <X size={20} className="text-ink-40" />
          </button>
        </div>
        <div className="space-y-2">
          {content.points.map((point, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sage-deep font-bold mt-0.5 flex-shrink-0 text-xs">•</span>
              <p className="text-sm text-ink-60">{point}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-ink-40 pt-2 border-t border-sand">
          Targets recalculate automatically when you update your body metrics.
        </p>
      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

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
      data-testid="toggle"
      aria-pressed={checked}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
    >
      <span
        className={`w-12 h-7 rounded-full transition-colors relative ${checked ? 'bg-sage-deep' : 'bg-sand'}`}
      >
        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}
