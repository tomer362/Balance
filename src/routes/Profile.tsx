import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Plus, User } from 'lucide-react';
import { useAppStore, selectActiveProfile } from '../store/appStore';
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
  const profile = useAppStore(selectActiveProfile);

  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);

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

  const totalLoggedToday = profile.foodLog.filter(
    (m) => m.timestamp.startsWith(new Date().toISOString().split('T')[0])
  ).length;

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
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-coral-accent font-medium border-t border-sand">
              <Plus size={16} />
              Add profile
            </button>
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
            <div key={p.id} className="flex items-center gap-3 py-1.5">
              <div className="w-8 h-8 rounded-full bg-sage-primary/20 flex items-center justify-center text-sm">👤</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-plum-dark">{p.name}</p>
                <p className="text-xs text-ink-40 capitalize">{p.mode} Mode</p>
              </div>
              {p.id === activeId && <span className="text-xs text-sage-deep font-medium">(you)</span>}
            </div>
          ))}
          <button className="flex items-center gap-2 mt-2 text-sm text-coral-accent font-medium">
            <Plus size={15} /> Add profile
          </button>
        </Section>

        {/* Data */}
        <Section title="Data">
          <div className="space-y-3">
            <button className="w-full text-left text-sm text-ink-60 py-1">Export to CSV</button>
            <button className="w-full text-left text-sm text-ink-60 py-1">Import from CSV</button>
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
