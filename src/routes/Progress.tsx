import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import { getCurrentPhase, getPhaseColor, getPhaseName, getPhaseNutritionBrief } from '../lib/cyclePhase';
import { analyzeGaps, sumNutrients } from '../lib/gapAnalysis';

type Period = 'week' | 'month' | '3m' | 'year';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 360) endDeg = startDeg + 359.99;
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const PHASE_ZONES = [
  { phase: 'menstrual', startFrac: 0, endFrac: 5 / 38, color: '#C85A44' },
  { phase: 'follicular', startFrac: 5 / 38, endFrac: 19 / 38, color: '#8FA989' },
  { phase: 'ovulatory', startFrac: 19 / 38, endFrac: 22 / 38, color: '#5C7A58' },
  { phase: 'luteal', startFrac: 22 / 38, endFrac: 1, color: '#E8B84F' },
];

export default function Progress() {
  const navigate = useNavigate();
  const profile = useAppStore(selectActiveProfile);
  const logWeight = useAppStore((s) => s.logWeight);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const [period, setPeriod] = useState<Period>('month');
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [todayMood, setTodayMood] = useState<'good' | 'ok' | 'low' | null>(null);

  if (!profile) return null;

  const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = profile.foodLog.filter((m) => m.timestamp.startsWith(today));
  const last28Meals = profile.foodLog.filter((m) => {
    const d = new Date(m.timestamp);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    return d >= cutoff;
  });

  // Filter weight history
  const now = new Date();
  const cutoffDate = new Date(now);
  if (period === 'week') cutoffDate.setDate(now.getDate() - 7);
  else if (period === 'month') cutoffDate.setDate(now.getDate() - 30);
  else if (period === '3m') cutoffDate.setDate(now.getDate() - 90);
  else cutoffDate.setFullYear(now.getFullYear() - 1);

  const filteredWeight = profile.weightHistory
    .filter((w) => new Date(w.date) >= cutoffDate)
    .map((w) => ({ date: w.date.slice(5), weight: w.kg }));

  const weightChange = filteredWeight.length >= 2
    ? filteredWeight[filteredWeight.length - 1].weight - filteredWeight[0].weight
    : 0;

  // Macro adherence
  const targets = profile.targets;
  const last28Nutrition = last28Meals.map((m) => m.nutrition);
  const totals28 = sumNutrients(last28Nutrition);
  const days28 = Math.max(1, Math.min(28, last28Meals.length > 0 ? 28 : 1));
  const dailyAvg = {
    protein_g: totals28.protein_g / days28,
    fiber_g: totals28.fiber_g / days28,
    omega3_g: (totals28.omega3_g ?? 0) / days28,
    glycemic_load: (totals28.glycemic_load ?? 0) / days28,
  };

  const adherence = {
    protein: Math.round(Math.min(1, dailyAvg.protein_g / (targets.protein_g || 1)) * 100),
    fiber: Math.round(Math.min(1, dailyAvg.fiber_g / (targets.fiber_g || 30)) * 100),
    omega3: Math.round(Math.min(1, dailyAvg.omega3_g / (targets.omega3_g || 3)) * 100),
  };

  const isTrainingDay = (() => {
    if (!profile.bulk?.trainingSchedule) return false;
    const d = new Date().getDay();
    const idx = d === 0 ? 6 : d - 1;
    return profile.bulk.trainingSchedule.weekPattern[idx] === 'training';
  })();

  const todaySplit = (() => {
    if (!profile.bulk?.trainingSchedule?.split) return null;
    const d = new Date().getDay();
    const idx = d === 0 ? 6 : d - 1;
    return profile.bulk.trainingSchedule.split[idx] ?? null;
  })();

  function handleLogSymptom() {
    if (!profile?.pcos) return;
    const updated = {
      ...profile.pcos,
      symptomLog: [
        ...profile.pcos.symptomLog.filter((s) => s.date !== today),
        { date: today, mood: todayMood ?? 'ok', symptoms: selectedSymptoms },
      ],
    };
    updateProfile(profile.id, { pcos: updated });
  }

  const cycleLength = profile.pcos?.cycle.avgCycleLength ?? 38;
  const SYMPTOMS = ['Cramps', 'Bloating', 'Acne', 'Fatigue', 'Cravings', 'Mood', 'Headache', 'Skin', 'Sleep'];

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sand">
          <ArrowLeft size={20} className="text-plum-dark" />
        </button>
        <h1 className="font-semibold text-plum-dark flex-1">Progress</h1>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          profile.mode === 'pcos' ? 'bg-sage-primary/20 text-sage-deep' : 'bg-coral-accent/15 text-coral-accent'
        }`}>
          {profile.mode === 'pcos' ? 'PCOS Mode' : 'Bulk Mode'}
        </span>
      </div>

      {/* Period selector */}
      <div className="px-4 mb-4">
        <div className="flex bg-sand rounded-xl p-1 gap-1">
          {(['week', 'month', '3m', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all uppercase ${
                period === p ? 'bg-white text-plum-dark shadow-sm' : 'text-ink-60'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4 pb-4">
        {/* Weight trend */}
        <div className="bg-cream-card rounded-2xl border border-sand p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-plum-dark">Weight trend</h2>
            <button
              onClick={() => setShowWeightInput(!showWeightInput)}
              className="w-8 h-8 rounded-full bg-sand flex items-center justify-center"
            >
              <Plus size={16} className="text-ink-60" />
            </button>
          </div>

          {showWeightInput && (
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="Current weight (kg)"
                className="flex-1 px-3 py-2 rounded-xl border border-sand text-sm bg-cream-bg"
              />
              <button
                onClick={() => {
                  if (newWeight && profile) {
                    logWeight(profile.id, parseFloat(newWeight));
                    setNewWeight('');
                    setShowWeightInput(false);
                  }
                }}
                className="px-3 py-2 bg-sage-deep text-white rounded-xl text-sm font-medium"
              >
                Log
              </button>
            </div>
          )}

          {filteredWeight.length > 1 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={filteredWeight}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D2" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8F7F90' }} tickLine={false} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10, fill: '#8F7F90' }}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #EFE4D2', fontSize: 12 }}
                    formatter={(val: number) => [`${val} kg`, 'Weight']}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#8FA989"
                    strokeWidth={2.5}
                    dot={{ fill: '#8FA989', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-ink-60 mt-2">
                {weightChange > 0 ? '↑' : '↓'}{' '}
                <span className={`font-semibold ${weightChange > 0 ? (profile.mode === 'bulk' ? 'text-moss' : 'text-terracotta') : (profile.mode === 'bulk' ? 'text-terracotta' : 'text-moss')}`}>
                  {Math.abs(weightChange).toFixed(1)} kg
                </span>
                {' '}this {period}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-40 text-center py-6">Log weight entries to see your trend.</p>
          )}
        </div>

        {/* PCOS: Cycle section */}
        {profile.mode === 'pcos' && phaseInfo && (
          <div className="bg-cream-card rounded-2xl border border-sand p-4">
            <h2 className="text-sm font-semibold text-plum-dark mb-4">Cycle tracking</h2>

            {/* Cycle ring */}
            <div className="flex justify-center mb-4">
              <svg width={220} height={220} viewBox="0 0 220 220">
                {/* Phase arcs */}
                {PHASE_ZONES.map(({ phase, startFrac, endFrac, color }) => {
                  const clampedLength = Math.min(cycleLength, 38);
                  const startDeg = startFrac * 360;
                  const endDeg = endFrac * 360;
                  return (
                    <path
                      key={phase}
                      d={describeArc(110, 110, 90, startDeg, endDeg - 1)}
                      fill="none"
                      stroke={color}
                      strokeWidth={14}
                      strokeLinecap="round"
                      opacity={0.5}
                    />
                  );
                })}
                {/* Today's position dot */}
                {(() => {
                  const pct = phaseInfo.cycleDay / cycleLength;
                  const angle = pct * 360;
                  const pos = polarToCartesian(110, 110, 90, angle);
                  return (
                    <circle
                      cx={pos.x} cy={pos.y} r={8}
                      fill={getPhaseColor(phaseInfo.phase)}
                      stroke="white"
                      strokeWidth={2.5}
                    />
                  );
                })()}

                {/* Center text */}
                <text x="110" y="102" textAnchor="middle" fontSize={13} fontFamily="Fraunces, serif" fontWeight="600" fill="#2D1B2E">
                  {getPhaseName(phaseInfo.phase).split(' ')[0].toUpperCase()}
                </text>
                <text x="110" y="120" textAnchor="middle" fontSize={11} fontFamily="Inter, sans-serif" fill="#5A4A5C">
                  Day {phaseInfo.cycleDay}
                </text>
                <text x="110" y="136" textAnchor="middle" fontSize={10} fontFamily="Inter, sans-serif" fill="#8F7F90">
                  ~{phaseInfo.daysUntilNextPeriod}d until period
                </text>
              </svg>
            </div>

            {/* Phase brief */}
            {(() => {
              const brief = getPhaseNutritionBrief(phaseInfo.phase);
              return (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {brief.priorities.slice(0, 3).map((p) => (
                      <span key={p} className="text-xs bg-moss/10 text-moss rounded-full px-2.5 py-1">✓ {p}</span>
                    ))}
                  </div>
                  {brief.seedCycling && (
                    <p className="text-xs text-ink-60 bg-amber-warn/10 rounded-xl px-3 py-2">
                      🌻 {brief.seedCycling}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Log period */}
            <button
              className="mt-3 w-full text-xs font-medium text-coral-accent border border-coral-accent/30 rounded-xl py-2.5"
              onClick={() => {
                if (!profile?.pcos) return;
                const today = new Date().toISOString().split('T')[0];
                updateProfile(profile.id, {
                  pcos: {
                    ...profile.pcos,
                    cycle: {
                      ...profile.pcos.cycle,
                      history: [{ start: today }, ...profile.pcos.cycle.history],
                    },
                  },
                });
              }}
            >
              📝 Log period start
            </button>
          </div>
        )}

        {/* Bulk: Training section */}
        {profile.mode === 'bulk' && (
          <div className="bg-cream-card rounded-2xl border border-sand p-4">
            <h2 className="text-sm font-semibold text-plum-dark mb-3">Training overview</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-60">Today</span>
                <span className={`text-sm font-semibold ${isTrainingDay ? 'text-coral-accent' : 'text-ink-40'}`}>
                  {isTrainingDay ? `Training · ${todaySplit ?? 'Day'}` : 'Rest day'}
                </span>
              </div>

              {/* Weekly schedule */}
              <div>
                <p className="text-xs text-ink-40 mb-2">Weekly schedule</p>
                <div className="flex gap-1.5">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                    const isTrain = profile.bulk?.trainingSchedule.weekPattern[i] === 'training';
                    const isCurrentDay = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                    return (
                      <div
                        key={i}
                        className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                          isTrain
                            ? isCurrentDay ? 'bg-sage-deep text-white' : 'bg-sage-primary/30 text-sage-deep'
                            : isCurrentDay ? 'bg-sand text-plum-dark' : 'bg-sand/50 text-ink-40'
                        }`}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
                {profile.bulk?.trainingSchedule.split && (
                  <div className="flex gap-1.5 mt-1">
                    {profile.bulk.trainingSchedule.split.map((s, i) => (
                      <div key={i} className="flex-1 text-center text-[9px] text-ink-40 truncate">
                        {s === 'Rest' ? '' : s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weight progress */}
              {filteredWeight.length >= 2 && (
                <div className="bg-sand/50 rounded-xl p-3">
                  <p className="text-xs font-medium text-plum-dark">Weight: {filteredWeight[filteredWeight.length - 1].weight} kg</p>
                  <p className="text-xs text-ink-60 mt-0.5">
                    {weightChange > 0 ? '↑' : '↓'} {Math.abs(weightChange).toFixed(1)} kg this {period}
                    {profile.mode === 'bulk' && weightChange > 0 && ' (on track 💪)'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Macro adherence */}
        <div className="bg-cream-card rounded-2xl border border-sand p-4">
          <h2 className="text-sm font-semibold text-plum-dark mb-3">Macro adherence (last 28 days)</h2>
          <div className="space-y-3">
            {[
              { label: 'Protein', pct: adherence.protein, color: '#E8876A' },
              { label: 'Fiber', pct: adherence.fiber, color: '#3F5D3C' },
              { label: 'Omega-3', pct: adherence.omega3, color: '#3B82F6' },
            ].map(({ label, pct, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ink-60">{label}</span>
                  <span className="font-semibold text-plum-dark font-mono-num">{pct}%</span>
                </div>
                <div className="h-2 bg-sand rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PCOS: Symptom tracker */}
        {profile.mode === 'pcos' && (
          <div className="bg-cream-card rounded-2xl border border-sand p-4">
            <h2 className="text-sm font-semibold text-plum-dark mb-3">Symptom check-in — today</h2>

            <p className="text-xs text-ink-60 mb-2">How are you feeling?</p>
            <div className="flex gap-2 mb-3">
              {(['good', 'ok', 'low'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTodayMood(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    todayMood === m ? 'bg-sage-primary/30 text-sage-deep' : 'bg-sand text-ink-60'
                  }`}
                >
                  {m === 'good' ? '😊 Good' : m === 'ok' ? '😐 OK' : '😔 Low'}
                </button>
              ))}
            </div>

            <p className="text-xs text-ink-60 mb-2">Symptoms (tap any):</p>
            <div className="flex flex-wrap gap-1.5">
              {SYMPTOMS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSymptoms((prev) =>
                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                  )}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedSymptoms.includes(s)
                      ? 'bg-terracotta/20 text-terracotta'
                      : 'bg-sand text-ink-60'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {(todayMood || selectedSymptoms.length > 0) && (
              <button
                onClick={handleLogSymptom}
                className="mt-3 w-full bg-sage-deep text-white rounded-xl py-2.5 text-sm font-semibold"
              >
                Save check-in
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
