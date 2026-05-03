import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAppStore, selectActiveProfile } from '../store/appStore';
import { getCurrentPhase, getPhaseColor } from '../lib/cyclePhase';
import { sumNutrients } from '../lib/gapAnalysis';
import { directionalIconClass, formatAmountWithUnit, phaseBrief, phaseShortName, useI18n } from '../lib/i18n';

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

type Period = 'week' | 'month' | '3m' | 'year';
type WeightEntry = { date: string; kg: number };

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatShortDate(date: Date, language: 'en' | 'he'): string {
  return date.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildWeightChartData(history: WeightEntry[], language: 'en' | 'he') {
  const weeklyAverages = new Map<string, number>();
  const entriesByWeek = new Map<string, number[]>();

  history.forEach((entry) => {
    const weekKey = startOfWeek(new Date(entry.date)).toISOString().split('T')[0];
    const weekEntries = entriesByWeek.get(weekKey) ?? [];
    weekEntries.push(entry.kg);
    entriesByWeek.set(weekKey, weekEntries);
  });

  entriesByWeek.forEach((weights, weekKey) => {
    weeklyAverages.set(weekKey, Number(average(weights).toFixed(2)));
  });

  return history.map((entry, index) => {
    const date = new Date(entry.date);
    const weekKey = startOfWeek(date).toISOString().split('T')[0];
    const movingWindow = history.slice(Math.max(0, index - 2), index + 1).map((item) => item.kg);
    return {
      date: entry.date,
      label: formatShortDate(date, language),
      weight: entry.kg,
      weeklyAverage: weeklyAverages.get(weekKey) ?? entry.kg,
      movingAverage: Number(average(movingWindow).toFixed(2)),
    };
  });
}

export default function Progress() {
  const { copy, language } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profile = useAppStore(selectActiveProfile);
  const logWeight = useAppStore((s) => s.logWeight);
  const updateWeightEntry = useAppStore((s) => s.updateWeightEntry);
  const deleteWeightEntry = useAppStore((s) => s.deleteWeightEntry);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const weightSectionRef = useRef<HTMLDivElement | null>(null);
  const cycleSectionRef = useRef<HTMLDivElement | null>(null);
  const symptomSectionRef = useRef<HTMLDivElement | null>(null);

  const [period, setPeriod] = useState<Period>('month');
  const [weightSearch, setWeightSearch] = useState('');
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [editingWeightDate, setEditingWeightDate] = useState<string | null>(null);
  const [editWeightDate, setEditWeightDate] = useState('');
  const [editWeightKg, setEditWeightKg] = useState('');
  const [periodStartDate, setPeriodStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [periodSavedMessage, setPeriodSavedMessage] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [todayMood, setTodayMood] = useState<'good' | 'ok' | 'low' | null>(null);
  const [symptomSavedMessage, setSymptomSavedMessage] = useState('');

  useEffect(() => {
    const section = searchParams.get('section');
    const target = section === 'weight'
      ? weightSectionRef
      : section === 'cycle'
      ? cycleSectionRef
      : section === 'symptoms'
      ? symptomSectionRef
      : null;
    if (target) {
      requestAnimationFrame(() => {
        target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [searchParams]);

  if (!profile) return null;

  const phaseInfo = profile.mode === 'pcos' ? getCurrentPhase(profile) : null;
  const today = new Date().toISOString().split('T')[0];
  const last28Meals = profile.foodLog.filter((m) => {
    const d = new Date(m.timestamp);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    return d >= cutoff;
  });

  const now = new Date();
  const cutoffDate = new Date(now);
  if (period === 'week') cutoffDate.setDate(now.getDate() - 7);
  else if (period === 'month') cutoffDate.setDate(now.getDate() - 30);
  else if (period === '3m') cutoffDate.setDate(now.getDate() - 90);
  else cutoffDate.setFullYear(now.getFullYear() - 1);

  const filteredWeightHistory = [...profile.weightHistory]
    .filter((w) => new Date(w.date) >= cutoffDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const weightChartData = buildWeightChartData(filteredWeightHistory, language);
  const normalizedWeightSearch = weightSearch.trim().toLowerCase();
  const visibleWeightChartData = normalizedWeightSearch
    ? weightChartData.filter((entry) =>
        `${entry.date} ${entry.label} ${entry.weight} ${entry.weeklyAverage} ${entry.movingAverage}`.toLowerCase().includes(normalizedWeightSearch)
      )
    : weightChartData;
  const latestWeight = filteredWeightHistory[filteredWeightHistory.length - 1]?.kg ?? profile.demographics.weight_kg;
  const firstWeight = filteredWeightHistory[0]?.kg ?? latestWeight;
  const weightChange = filteredWeightHistory.length >= 2
    ? latestWeight - firstWeight
    : 0;
  const entryCount = filteredWeightHistory.length;
  const daysCovered = filteredWeightHistory.length >= 2
    ? Math.max(
        1,
        Math.round(
          (new Date(filteredWeightHistory[filteredWeightHistory.length - 1].date).getTime() -
            new Date(filteredWeightHistory[0].date).getTime()) /
            86400000
        )
      )
    : 0;
  const averageWeeklyChange = daysCovered > 0 ? (weightChange / daysCovered) * 7 : 0;
  const currentWeeklyAverage = weightChartData.length > 0
    ? weightChartData[weightChartData.length - 1].weeklyAverage
    : latestWeight;
  const recentMovingAverage = weightChartData.length > 0
    ? weightChartData[weightChartData.length - 1].movingAverage
    : latestWeight;
  const minWeight = filteredWeightHistory.length > 0 ? Math.min(...filteredWeightHistory.map((entry) => entry.kg)) : latestWeight;
  const maxWeight = filteredWeightHistory.length > 0 ? Math.max(...filteredWeightHistory.map((entry) => entry.kg)) : latestWeight;
  const progressTowardGoal = Math.abs(firstWeight - profile.demographics.goal_weight_kg) > 0
    ? Math.max(
        -100,
        Math.min(
          100,
          Math.round(
            ((Math.abs(firstWeight - profile.demographics.goal_weight_kg) -
              Math.abs(latestWeight - profile.demographics.goal_weight_kg)) /
              Math.abs(firstWeight - profile.demographics.goal_weight_kg)) *
              100
          )
        )
      )
    : 0;
  const latestWeightDate = filteredWeightHistory[filteredWeightHistory.length - 1]?.date ?? today;
  const recentEntries = [...filteredWeightHistory]
    .reverse()
    .filter((entry) =>
      normalizedWeightSearch
        ? `${entry.date} ${formatShortDate(new Date(entry.date), language)} ${entry.kg}`.toLowerCase().includes(normalizedWeightSearch)
        : true
    )
    .slice(0, 8);
  const periodHistory = [...(profile.pcos?.cycle.history ?? [])].sort((a, b) => b.start.localeCompare(a.start));
  const cycleLengthData = [...periodHistory]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((entry, index, entries) => {
      if (index === 0) return null;
      const previous = new Date(entries[index - 1].start);
      const current = new Date(entry.start);
      const days = Math.max(1, Math.round((current.getTime() - previous.getTime()) / 86400000));
      return {
        label: formatShortDate(current, language),
        days,
      };
    })
    .filter(Boolean) as Array<{ label: string; days: number }>;
  const symptomTrendData = [...(profile.pcos?.symptomLog ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((entry) => ({
      date: entry.date,
      label: formatShortDate(new Date(entry.date), language),
      count: entry.symptoms.length,
      moodScore: entry.mood === 'good' ? 3 : entry.mood === 'ok' ? 2 : entry.mood === 'low' ? 1 : 0,
    }));
  const latestSymptomLog = [...(profile.pcos?.symptomLog ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];

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
    setSymptomSavedMessage(copy.progress.symptomSaved(todayMood ?? 'ok', selectedSymptoms.length));
  }

  function startEditingWeight(entry: WeightEntry) {
    setEditingWeightDate(entry.date);
    setEditWeightDate(entry.date);
    setEditWeightKg(String(entry.kg));
  }

  function cancelEditingWeight() {
    setEditingWeightDate(null);
    setEditWeightDate('');
    setEditWeightKg('');
  }

  function saveEditingWeight() {
    if (!profile || !editingWeightDate || !editWeightDate || !editWeightKg) return;
    const parsedWeight = parseFloat(editWeightKg);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) return;

    updateWeightEntry(profile.id, editingWeightDate, {
      date: editWeightDate,
      kg: Math.round(parsedWeight * 10) / 10,
    });
    cancelEditingWeight();
  }

  function removeWeightEntry(date: string) {
    if (!profile) return;
    deleteWeightEntry(profile.id, date);
    if (editingWeightDate === date) cancelEditingWeight();
  }

  function logPeriodStart() {
    if (!profile?.pcos || !periodStartDate) return;
    updateProfile(profile.id, {
      pcos: {
        ...profile.pcos,
        cycle: {
          ...profile.pcos.cycle,
          currentPhaseOverride: undefined,
          history: [
            { start: periodStartDate },
            ...profile.pcos.cycle.history.filter((entry) => entry.start !== periodStartDate),
          ].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()),
        },
      },
    });
    setPeriodSavedMessage(copy.progress.periodSaved(formatShortDate(new Date(periodStartDate), language)));
  }

  const cycleLength = profile.pcos?.cycle.avgCycleLength ?? 38;
  return (
    <div className="main-content min-h-screen bg-cream-bg">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sand">
          <ArrowLeft size={20} className={`text-plum-dark ${directionalIconClass(language)}`} />
        </button>
        <h1 className="font-semibold text-plum-dark flex-1">{copy.progress.title}</h1>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          profile.mode === 'pcos' ? 'bg-sage-primary/20 text-sage-deep' : 'bg-coral-accent/15 text-coral-accent'
        }`}>
          {profile.mode === 'pcos' ? copy.progress.modePcos : copy.progress.modeBulk}
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
                {copy.progress.periods[p]}
              </button>
            ))}
        </div>
      </div>

      <div className="px-4 space-y-4 pb-4">
        {/* Weight trend */}
        <div
          ref={weightSectionRef}
          id="weight-history"
          className="scroll-mt-4 bg-cream-card rounded-2xl border border-sand p-4"
          data-testid="weight-history-section"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-plum-dark">{copy.progress.weightTrend}</h2>
            <button
              onClick={() => setShowWeightInput(!showWeightInput)}
              className="w-8 h-8 rounded-full bg-sand flex items-center justify-center"
              data-testid="progress-weight-toggle"
            >
              <Plus size={16} className="text-ink-60" />
            </button>
          </div>

          {showWeightInput && (
            <div className="mb-4 rounded-2xl bg-sand/35 p-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder={copy.progress.currentWeightKg}
                  className="flex-1 px-3 py-2 rounded-xl border border-sand text-sm bg-cream-bg"
                  data-testid="progress-weight-input"
                />
                <button
                  onClick={() => {
                    if (newWeight && profile) {
                      logWeight(profile.id, Math.round(parseFloat(newWeight) * 10) / 10);
                      setNewWeight('');
                      setShowWeightInput(false);
                    }
                  }}
                  className="px-3 py-2 bg-sage-deep text-white rounded-xl text-sm font-medium"
                  data-testid="progress-weight-save"
                >
                  {copy.progress.log}
                </button>
              </div>
              <p className="text-xs text-ink-40 mt-2">
                {copy.progress.lastLogged(formatShortDate(new Date(latestWeightDate), language,))}
              </p>
            </div>
          )}

          <input
            value={weightSearch}
            onChange={(e) => setWeightSearch(e.target.value)}
            placeholder={copy.progress.searchWeightHistory}
            className="mb-3 w-full rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark outline-none placeholder:text-ink-40"
            data-testid="weight-history-search"
          />

          {visibleWeightChartData.length > 1 ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4" data-testid="weight-analysis-cards">
                <MetricPill
                  label={copy.progress.current}
                  value={formatAmountWithUnit(latestWeight, 'kg', language, 1)}
                  tone="neutral"
                />
                <MetricPill
                  label={copy.progress.changeThisPeriod}
                  value={`${weightChange > 0 ? '+' : ''}${formatAmountWithUnit(weightChange, 'kg', language, 1)}`}
                  tone={weightChange > 0 ? (profile.mode === 'bulk' ? 'good' : 'warn') : weightChange < 0 ? (profile.mode === 'bulk' ? 'warn' : 'good') : 'neutral'}
                />
                <MetricPill
                  label={copy.progress.weeklyAverage}
                  value={formatAmountWithUnit(currentWeeklyAverage, 'kg', language, 1)}
                  tone="neutral"
                />
                <MetricPill
                  label={copy.progress.avgWeeklyRate}
                  value={`${averageWeeklyChange > 0 ? '+' : ''}${formatAmountWithUnit(averageWeeklyChange, 'kg', language, 2)}`}
                  tone={averageWeeklyChange > 0 ? (profile.mode === 'bulk' ? 'good' : 'warn') : averageWeeklyChange < 0 ? (profile.mode === 'bulk' ? 'warn' : 'good') : 'neutral'}
                />
              </div>

              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={visibleWeightChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D2" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8F7F90' }} tickLine={false} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10, fill: '#8F7F90' }}
                    tickLine={false}
                    width={32}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #EFE4D2', fontSize: 12 }}
                    formatter={(val: number, key: string) => [formatAmountWithUnit(val, 'kg', language, 1), key === 'weeklyAverage' ? copy.progress.weeklyAverage : key === 'movingAverage' ? copy.progress.shortTrend : copy.progress.dailyEntries]}
                    labelFormatter={(_, payload: any) => payload?.[0]?.payload?.label ?? ''}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#8FA989"
                    strokeWidth={2.5}
                    dot={{ fill: '#8FA989', r: 3 }}
                    activeDot={{ r: 5 }}
                    name={copy.progress.dailyEntries}
                  />
                  <Line
                    type="monotone"
                    dataKey="weeklyAverage"
                    stroke="#E8876A"
                    strokeWidth={2.5}
                    dot={false}
                    strokeDasharray="5 4"
                    name={copy.progress.weeklyAverage}
                  />
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    stroke="#3F5D3C"
                    strokeWidth={1.8}
                    dot={false}
                    name={copy.progress.shortTrend}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-4 rounded-2xl bg-sand/35 p-3 space-y-2" data-testid="weight-analysis-summary">
                <p className="text-xs text-ink-60">
                  {copy.progress.rangeSummary(
                    formatAmountWithUnit(minWeight, 'kg', language, 1),
                    formatAmountWithUnit(maxWeight, 'kg', language, 1),
                    entryCount
                  )}
                </p>
                <p className="text-xs text-ink-60">
                  {copy.progress.goalProgress(progressTowardGoal)}
                </p>
                <p className="text-xs text-ink-60">
                  {copy.progress.trendVsScale(
                    formatAmountWithUnit(recentMovingAverage, 'kg', language, 1),
                    copy.progress.periods[period]
                  )}
                </p>
              </div>

              <div className="mt-3" data-testid="weight-history-list">
                <h3 className="text-xs font-semibold text-ink-40 uppercase tracking-wide mb-2">{copy.progress.recentEntries}</h3>
                <div className="space-y-1.5">
                  {recentEntries.map((entry) => (
                    <div
                      key={entry.date}
                      className="rounded-xl border border-sand bg-cream-bg px-3 py-2"
                      data-testid="weight-history-entry"
                    >
                      {editingWeightDate === entry.date ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-[1fr_0.8fr] gap-2">
                            <label className="text-[11px] font-medium text-ink-60">
                              {copy.progress.entryDate}
                              <input
                                type="date"
                                value={editWeightDate}
                                onChange={(e) => setEditWeightDate(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-sand bg-white px-2 py-1.5 text-xs text-plum-dark"
                                data-testid="weight-entry-date-input"
                              />
                            </label>
                            <label className="text-[11px] font-medium text-ink-60">
                              {copy.progress.entryWeight}
                              <input
                                type="number"
                                inputMode="decimal"
                                value={editWeightKg}
                                onChange={(e) => setEditWeightKg(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-sand bg-white px-2 py-1.5 text-xs text-plum-dark font-mono-num"
                                data-testid="weight-entry-weight-input"
                              />
                            </label>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={saveEditingWeight}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-sage-deep px-2 py-1.5 text-xs font-medium text-white"
                              data-testid="weight-entry-save"
                            >
                              <Check size={13} />
                              {copy.progress.saveEntry}
                            </button>
                            <button
                              onClick={cancelEditingWeight}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-sand px-2 py-1.5 text-xs font-medium text-ink-60"
                              data-testid="weight-entry-cancel"
                            >
                              <X size={13} />
                              {copy.progress.cancelEdit}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-xs text-ink-60">{formatShortDate(new Date(entry.date), language)}</span>
                            <span className="block text-sm font-semibold text-plum-dark font-mono-num">{formatAmountWithUnit(entry.kg, 'kg', language, 1)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditingWeight(entry)}
                              className="rounded-lg bg-sand/70 p-2 text-ink-60 transition-colors hover:text-plum-dark"
                              aria-label={copy.progress.editEntry}
                              data-testid="weight-entry-edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => removeWeightEntry(entry.date)}
                              className="rounded-lg bg-terracotta/10 p-2 text-terracotta transition-colors hover:bg-terracotta/20"
                              aria-label={copy.progress.deleteEntry}
                              data-testid="weight-entry-delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-40 text-center py-6">{copy.progress.logWeightPrompt}</p>
          )}
        </div>

        {/* PCOS: Cycle section */}
        {profile.mode === 'pcos' && phaseInfo && (
          <div ref={cycleSectionRef} className="scroll-mt-4 bg-cream-card rounded-2xl border border-sand p-4" data-testid="cycle-history-section">
            <h2 className="text-sm font-semibold text-plum-dark mb-4">{copy.progress.cycleTracking}</h2>

            {/* Cycle ring */}
            <div className="flex justify-center mb-4">
              <svg width={220} height={220} viewBox="0 0 220 220">
                {/* Phase arcs */}
                {PHASE_ZONES.map(({ phase, startFrac, endFrac, color }) => {
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
                  {phaseShortName(phaseInfo.phase, language)}
                </text>
                <text x="110" y="120" textAnchor="middle" fontSize={11} fontFamily="Inter, sans-serif" fill="#5A4A5C">
                  {copy.dashboard.day} {phaseInfo.cycleDay}
                </text>
                <text x="110" y="136" textAnchor="middle" fontSize={10} fontFamily="Inter, sans-serif" fill="#8F7F90">
                  {copy.progress.untilPeriod(phaseInfo.daysUntilNextPeriod)}
                </text>
              </svg>
            </div>

            {/* Phase brief */}
            {(() => {
               const brief = phaseBrief(phaseInfo.phase, language);
              return (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {brief.priorities.slice(0, 3).map((p) => (
                      <span key={p} className="text-xs bg-moss/10 text-moss rounded-full px-2.5 py-1">✓ {p}</span>
                    ))}
                  </div>
                  {profile.pcos?.seedCyclingEnabled && brief.seedCycling && (
                    <p className="text-xs text-ink-60 bg-amber-warn/10 rounded-xl px-3 py-2">
                      {copy.progress.seedCyclingReminder(brief.seedCycling)}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Log period */}
            <div className="mt-3 rounded-2xl border border-coral-accent/20 bg-coral-accent/5 p-3">
              <label className="text-xs font-medium text-ink-60 block mb-1.5">{copy.progress.periodStartDate}</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={periodStartDate}
                  max={today}
                  onChange={(e) => setPeriodStartDate(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
                  data-testid="period-start-date-input"
                />
                <button
                  className="px-3 py-2 text-xs font-medium text-white bg-coral-accent rounded-xl"
                  onClick={logPeriodStart}
                  data-testid="period-start-save"
                >
                  {copy.progress.logPeriodStart}
                </button>
              </div>
              <p className="text-[11px] text-ink-40 mt-2">
                {copy.progress.periodBackdateHelper}
              </p>
              {periodSavedMessage && (
                <p className="mt-2 rounded-xl bg-sage-primary/15 px-3 py-2 text-xs font-medium text-sage-deep" data-testid="period-start-saved">
                  {periodSavedMessage}
                </p>
              )}
              {periodHistory.length > 0 && (
                <div className="mt-3 rounded-2xl bg-cream-bg p-3" data-testid="period-history-list">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-40">{copy.progress.recentPeriodStarts}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {periodHistory.slice(0, 6).map((entry) => (
                      <span key={entry.start} className="rounded-full bg-coral-accent/10 px-2.5 py-1 text-xs font-medium text-coral-accent">
                        {formatShortDate(new Date(entry.start), language)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {cycleLengthData.length > 0 && (
                <div className="mt-3 h-36 rounded-2xl bg-cream-bg p-2" data-testid="cycle-length-chart">
                  <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-40">{copy.progress.cycleLengthTrend}</p>
                  <ResponsiveContainer width="100%" height="82%">
                    <LineChart data={cycleLengthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D2" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8F7F90' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#8F7F90' }} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFE4D2', fontSize: 12 }} formatter={(value: number) => [`${value}d`, copy.progress.cycleLength]} />
                      <Line type="monotone" dataKey="days" stroke="#E8876A" strokeWidth={2.5} dot={{ r: 3, fill: '#E8876A' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
           </div>
         )}

        {/* Bulk: Training section */}
        {profile.mode === 'bulk' && (
          <div className="bg-cream-card rounded-2xl border border-sand p-4">
            <h2 className="text-sm font-semibold text-plum-dark mb-3">{copy.progress.trainingOverview}</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-60">{copy.progress.today}</span>
                <span className={`text-sm font-semibold ${isTrainingDay ? 'text-coral-accent' : 'text-ink-40'}`}>
                  {isTrainingDay ? `${copy.dashboard.training} · ${todaySplit ?? copy.dashboard.day}` : copy.dashboard.restDay}
                </span>
              </div>

              {/* Weekly schedule */}
              <div>
                 <p className="text-xs text-ink-40 mb-2">{copy.progress.weeklySchedule}</p>
                 <div className="flex gap-1.5">
                   {copy.progress.weekdaysShort.map((day, i) => {
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
              {filteredWeightHistory.length >= 2 && (
                <div className="bg-sand/50 rounded-xl p-3">
                   <p className="text-xs font-medium text-plum-dark">{copy.common.weight}: {formatAmountWithUnit(latestWeight, 'kg', language, 1)}</p>
                   <p className="text-xs text-ink-60 mt-0.5">
                     {weightChange > 0 ? '↑' : '↓'} {formatAmountWithUnit(Math.abs(weightChange), 'kg', language, 1)} {copy.progress.thisPeriod(copy.progress.periods[period])}
                     {profile.mode === 'bulk' && weightChange > 0 && ` (${copy.progress.onTrack} 💪)`}
                   </p>
                 </div>
              )}
            </div>
          </div>
        )}

        {/* Macro adherence */}
        <div className="bg-cream-card rounded-2xl border border-sand p-4">
           <h2 className="text-sm font-semibold text-plum-dark mb-3">{copy.progress.macroAdherence}</h2>
          <div className="space-y-3">
            {[
               { label: copy.common.protein, pct: adherence.protein, color: '#E8876A' },
               { label: copy.common.fiber, pct: adherence.fiber, color: '#3F5D3C' },
               { label: copy.common.omega3, pct: adherence.omega3, color: '#3B82F6' },
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
          <div ref={symptomSectionRef} className="scroll-mt-4 bg-cream-card rounded-2xl border border-sand p-4" data-testid="symptom-history-section">
             <h2 className="text-sm font-semibold text-plum-dark mb-3">{copy.progress.symptomCheckin}</h2>
             {latestSymptomLog && (
               <p className="mb-3 rounded-2xl bg-sage-primary/10 px-3 py-2 text-xs text-sage-deep" data-testid="latest-symptom-checkin">
                 {copy.progress.lastSymptomCheckin(
                   formatShortDate(new Date(latestSymptomLog.date), language),
                   latestSymptomLog.symptoms.length
                 )}
               </p>
             )}

             <p className="text-xs text-ink-60 mb-2">{copy.progress.howFeeling}</p>
            <div className="flex gap-2 mb-3">
              {(['good', 'ok', 'low'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTodayMood(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    todayMood === m ? 'bg-sage-primary/30 text-sage-deep' : 'bg-sand text-ink-60'
                  }`}
                >
                  {copy.progress.mood[m]}
                </button>
              ))}
            </div>

             <p className="text-xs text-ink-60 mb-2">{copy.progress.symptomsTap}</p>
             <div className="flex flex-wrap gap-1.5">
               {copy.progress.symptoms.map((s) => (
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
                data-testid="symptom-checkin-save"
              >
                 {copy.progress.saveCheckin}
               </button>
             )}
            {symptomSavedMessage && (
              <p className="mt-2 rounded-xl bg-sage-primary/15 px-3 py-2 text-xs font-medium text-sage-deep" data-testid="symptom-checkin-saved">
                {symptomSavedMessage}
              </p>
            )}
            {symptomTrendData.length > 0 && (
              <div className="mt-4 rounded-2xl bg-cream-bg p-3" data-testid="symptom-trend-chart">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-40">{copy.progress.symptomTrend}</h3>
                <div className="mt-2 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={symptomTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D2" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8F7F90' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#8F7F90' }} tickLine={false} width={28} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #EFE4D2', fontSize: 12 }}
                        formatter={(value: number, key: string) => [value, key === 'moodScore' ? copy.progress.moodScore : copy.progress.symptomCount]}
                      />
                      <Line type="monotone" dataKey="count" stroke="#C85A44" strokeWidth={2.5} dot={{ r: 3, fill: '#C85A44' }} name={copy.progress.symptomCount} />
                      <Line type="monotone" dataKey="moodScore" stroke="#5C7A58" strokeWidth={2} dot={false} strokeDasharray="4 4" name={copy.progress.moodScore} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-1.5" data-testid="symptom-history-list">
                  {[...(profile.pcos?.symptomLog ?? [])]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 5)
                    .map((entry) => (
                      <div key={entry.date} className="flex items-center justify-between rounded-xl bg-sand/35 px-3 py-2 text-xs">
                        <span className="font-medium text-plum-dark">{formatShortDate(new Date(entry.date), language)}</span>
                        <span className="text-ink-60">{entry.symptoms.length ? entry.symptoms.join(', ') : copy.progress.noSymptoms}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warn';
}) {
  const toneClass = tone === 'good'
    ? 'bg-moss/10 text-moss border-moss/15'
    : tone === 'warn'
    ? 'bg-terracotta/10 text-terracotta border-terracotta/15'
    : 'bg-sand/35 text-plum-dark border-sand';

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-sm font-semibold font-mono-num">{value}</p>
    </div>
  );
}
