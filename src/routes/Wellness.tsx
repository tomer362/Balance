import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Droplets, Dumbbell, Footprints } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { defaultHabitSettings, selectActiveProfile, useAppStore } from '../store/appStore';
import type { DatedNumberLog } from '../store/appStore';
import { directionalIconClass, formatAmountWithUnit, formatDateValue, useI18n } from '../lib/i18n';

type Period = 'week' | 'month' | '3m';

type ChartPoint = {
  date: string;
  label: string;
  shortLabel: string;
  value: number;
  hasEntry: boolean;
};

type WaterConsistencyPoint = ChartPoint & {
  status: number;
  state: 'reached' | 'missed' | 'not-logged';
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function periodDays(period: Period): number {
  if (period === 'week') return 7;
  if (period === 'month') return 30;
  return 90;
}

function logValue(history: DatedNumberLog[] | undefined, date: string): number {
  return history?.find((entry) => entry.date === date)?.value ?? 0;
}

function shortDateLabel(date: Date, period: Period, language: 'en' | 'he'): string {
  if (period === 'week') {
    return formatDateValue(date, language, { weekday: 'short' });
  }
  return formatDateValue(date, language, { month: 'short', day: 'numeric' });
}

function chartTickInterval(length: number): number {
  if (length <= 7) return 0;
  if (length <= 30) return 4;
  return 11;
}

function chartBarSize(length: number): number {
  if (length <= 7) return 22;
  if (length <= 30) return 10;
  return 4;
}

function axisValue(value: number, unit: string): string {
  if (unit === 'ml') {
    return value >= 1000 ? `${Number((value / 1000).toFixed(1))}L` : `${value}`;
  }
  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(1))}k`;
  }
  return `${value}`;
}

function chartData(history: DatedNumberLog[] | undefined, period: Period, language: 'en' | 'he', search = ''): ChartPoint[] {
  const days = periodDays(period);
  const start = addDays(new Date(), -(days - 1));
  const values = new Map((history ?? []).map((entry) => [entry.date, entry.value]));
  const normalizedSearch = search.trim().toLowerCase();

  const data = Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const key = isoDate(date);
    const hasEntry = values.has(key);
    return {
      date: key,
      label: formatDateValue(date, language, { month: 'short', day: 'numeric' }),
      shortLabel: shortDateLabel(date, period, language),
      value: values.get(key) ?? 0,
      hasEntry,
    };
  });
  return normalizedSearch
    ? data.filter((entry) => `${entry.date} ${entry.label} ${entry.value}`.toLowerCase().includes(normalizedSearch))
    : data;
}

function waterConsistencyData(
  history: DatedNumberLog[] | undefined,
  period: Period,
  language: 'en' | 'he',
  goal: number,
  search = '',
): WaterConsistencyPoint[] {
  return chartData(history, period, language, search).map((entry) => ({
    ...entry,
    status: entry.hasEntry ? 1 : 0.35,
    state: !entry.hasEntry ? 'not-logged' : entry.value >= goal ? 'reached' : 'missed',
  }));
}

function weeklyWorkoutCount(history: Array<{ date: string; completed: boolean }> | undefined): number {
  const weekStart = isoDate(startOfWeek(new Date()));
  return (history ?? []).filter((entry) => entry.completed && isoDate(startOfWeek(new Date(entry.date))) === weekStart).length;
}

export default function Wellness() {
  const { copy, language } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profile = useAppStore(selectActiveProfile);
  const logSteps = useAppStore((s) => s.logSteps);
  const logWater = useAppStore((s) => s.logWater);
  const toggleWorkoutLog = useAppStore((s) => s.toggleWorkoutLog);
  const setHabitSettings = useAppStore((s) => s.setHabitSettings);

  const stepsRef = useRef<HTMLDivElement | null>(null);
  const workoutsRef = useRef<HTMLDivElement | null>(null);
  const waterRef = useRef<HTMLDivElement | null>(null);

  const [stepsDate, setStepsDate] = useState(todayStr());
  const [waterDate, setWaterDate] = useState(todayStr());
  const [waterText, setWaterText] = useState('');
  const [period, setPeriod] = useState<Period>('week');
  const [historySearch, setHistorySearch] = useState('');

  const settings = {
    ...defaultHabitSettings(),
    ...(profile?.habitSettings ?? {}),
    reminders: {
      ...defaultHabitSettings().reminders,
      ...(profile?.habitSettings?.reminders ?? {}),
    },
  };

  const today = todayStr();
  const todaySteps = logValue(profile?.stepHistory, today);
  const todayWater = logValue(profile?.waterHistory, today);
  const workoutsThisWeek = weeklyWorkoutCount(profile?.workoutHistory);
  const workoutDoneToday = (profile?.workoutHistory ?? []).some((entry) => entry.date === today && entry.completed);
  const workoutRemaining = Math.max(0, settings.workoutGoalPerWeek - workoutsThisWeek);

  const stepChartData = useMemo(() => chartData(profile?.stepHistory, period, language, historySearch), [profile?.stepHistory, period, language, historySearch]);
  const waterChartData = useMemo(() => chartData(profile?.waterHistory, period, language, historySearch), [profile?.waterHistory, period, language, historySearch]);
  const waterConsistencyChartData = useMemo(
    () => waterConsistencyData(profile?.waterHistory, period, language, settings.waterGoalMl, historySearch),
    [profile?.waterHistory, period, language, settings.waterGoalMl, historySearch]
  );
  const waterPeriodData = useMemo(
    () => chartData(profile?.waterHistory, period, language),
    [profile?.waterHistory, period, language]
  );

  useEffect(() => {
    const section = searchParams.get('section');
    const target = section === 'workouts' ? workoutsRef : section === 'water' ? waterRef : section === 'steps' ? stepsRef : null;
    if (target) {
      requestAnimationFrame(() => target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [searchParams]);

  useEffect(() => {
    setWaterText(String(logValue(profile?.waterHistory, waterDate) || ''));
  }, [profile?.waterHistory, waterDate]);

  if (!profile) return null;

  const alerts = [
    settings.reminders.steps && todaySteps < settings.stepGoal
      ? copy.wellness.alerts.steps(settings.stepGoal - todaySteps)
      : null,
    settings.reminders.workouts && workoutRemaining > 0
      ? copy.wellness.alerts.workouts(workoutRemaining, settings.workoutGoalPerWeek)
      : null,
    settings.reminders.water && todayWater < settings.waterGoalMl
      ? copy.wellness.alerts.water(settings.waterGoalMl - todayWater)
      : null,
  ].filter(Boolean) as string[];
  const waterGoalDays = waterPeriodData.filter((entry) => entry.value >= settings.waterGoalMl).length;
  const waterTotalDays = waterPeriodData.length;
  const waterConsistencyPct = waterTotalDays > 0 ? Math.round((waterGoalDays / waterTotalDays) * 100) : 0;
  const waterAverageMl = waterTotalDays > 0
    ? Math.round(waterPeriodData.reduce((sum, entry) => sum + entry.value, 0) / waterTotalDays)
    : 0;

  function toggleStepsGoal() {
    logSteps(profile!.id, stepsDate, logValue(profile?.stepHistory, stepsDate) >= settings.stepGoal ? 0 : settings.stepGoal);
  }

  function saveWater(nextValue?: number) {
    const parsed = nextValue ?? Number(waterText);
    if (!Number.isFinite(parsed)) return;
    logWater(profile!.id, waterDate, parsed);
  }

  return (
    <div className="main-content min-h-screen bg-cream-bg">
      <div className="sticky top-0 z-10 bg-cream-bg px-4 pt-4 pb-3 border-b border-sand/50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="tap-target flex items-center justify-center rounded-full hover:bg-sand transition-colors">
            <ArrowLeft size={20} className={`text-plum-dark ${directionalIconClass(language)}`} />
          </button>
          <div>
            <h1 className="font-semibold text-plum-dark">{copy.wellness.title}</h1>
            <p className="text-xs text-ink-40">{copy.wellness.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="rounded-3xl border border-sand bg-cream-card p-4" data-testid="wellness-alerts">
          <h2 className="text-sm font-semibold text-plum-dark mb-2">{copy.wellness.todayAlerts}</h2>
          {alerts.length === 0 ? (
            <p className="rounded-2xl bg-sage-primary/10 px-3 py-2 text-sm text-sage-deep">{copy.wellness.allClear}</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <p key={alert} className="rounded-2xl bg-amber-warn/15 px-3 py-2 text-sm text-plum-dark">
                  {alert}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {(['week', 'month', '3m'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold uppercase ${period === p ? 'bg-sage-deep text-white' : 'bg-sand text-ink-60'}`}
            >
              {copy.progress.periods[p]}
            </button>
          ))}
        </div>
        <input
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          placeholder={copy.wellness.searchHistory}
          className="w-full rounded-xl border border-sand bg-cream-card px-3 py-2 text-sm text-plum-dark outline-none placeholder:text-ink-40"
          data-testid="wellness-history-search"
        />

        <section ref={stepsRef} className="scroll-mt-24 rounded-3xl border border-sand bg-cream-card p-4" data-testid="steps-section">
          <SectionHeader icon={<Footprints size={18} />} title={copy.wellness.steps.title} subtitle={copy.wellness.steps.subtitle(settings.stepGoal)} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Metric label={copy.wellness.today} value={todaySteps.toLocaleString()} />
            <Metric label={copy.wellness.goal} value={settings.stepGoal.toLocaleString()} />
          </div>
          <div className="mt-3 grid grid-cols-[0.8fr_1fr] gap-2">
            <input
              type="date"
              value={stepsDate}
              onChange={(e) => setStepsDate(e.target.value)}
              className="rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
              data-testid="steps-date-input"
            />
            <button
              onClick={toggleStepsGoal}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                logValue(profile.stepHistory, stepsDate) >= settings.stepGoal ? 'border-sage-deep bg-sage-deep text-white' : 'border-sand bg-cream-bg text-plum-dark'
              }`}
              data-testid="steps-goal-toggle"
            >
              {logValue(profile.stepHistory, stepsDate) >= settings.stepGoal && <Check size={15} />}
              {logValue(profile.stepHistory, stepsDate) >= settings.stepGoal ? copy.wellness.steps.done : copy.wellness.steps.markDone}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-40">{copy.wellness.steps.fastHelper}</p>
          <HistoryChart data={stepChartData} unit="" goal={settings.stepGoal} language={language} />
        </section>

        <section ref={workoutsRef} className="scroll-mt-24 rounded-3xl border border-sand bg-cream-card p-4" data-testid="workouts-section">
          <SectionHeader icon={<Dumbbell size={18} />} title={copy.wellness.workouts.title} subtitle={copy.wellness.workouts.subtitle} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Metric label={copy.wellness.thisWeek} value={`${workoutsThisWeek}/${settings.workoutGoalPerWeek}`} />
            <Metric label={copy.wellness.remaining} value={String(workoutRemaining)} />
          </div>
          <label className="mt-3 block text-xs text-ink-60">
            {copy.wellness.workouts.goalLabel}
            <input
              type="number"
              min="0"
              max="14"
              value={settings.workoutGoalPerWeek}
              onChange={(e) => setHabitSettings(profile.id, { workoutGoalPerWeek: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              className="mt-1 w-full rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
              data-testid="workout-goal-input"
            />
          </label>
          <button
            onClick={() => toggleWorkoutLog(profile.id, today)}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold ${workoutDoneToday ? 'border-sage-deep bg-sage-deep text-white' : 'border-sand bg-cream-bg text-plum-dark'}`}
            data-testid="workout-toggle"
          >
            {workoutDoneToday && <Check size={16} />}
            {workoutDoneToday ? copy.wellness.workouts.doneToday : copy.wellness.workouts.logToday}
          </button>
          <p className="mt-2 text-xs text-ink-40">{copy.wellness.workouts.helper}</p>
        </section>

        <section ref={waterRef} className="scroll-mt-24 rounded-3xl border border-sand bg-cream-card p-4" data-testid="water-section">
          <SectionHeader icon={<Droplets size={18} />} title={copy.wellness.water.title} subtitle={copy.wellness.water.subtitle(settings.waterGoalMl)} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Metric label={copy.wellness.today} value={formatAmountWithUnit(todayWater, 'ml', language)} />
            <Metric label={copy.wellness.goal} value={formatAmountWithUnit(settings.waterGoalMl, 'ml', language)} />
          </div>
          <div className="mt-3 grid grid-cols-[0.8fr_1fr] gap-2">
            <input
              type="date"
              value={waterDate}
              onChange={(e) => setWaterDate(e.target.value)}
              className="rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
              data-testid="water-date-input"
            />
            <input
              type="number"
              inputMode="numeric"
              value={waterText}
              onChange={(e) => setWaterText(e.target.value)}
              placeholder={copy.wellness.water.placeholder}
              className="rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
              data-testid="water-input"
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[250, 500, 750].map((ml) => (
              <button
                key={ml}
                onClick={() => saveWater((Number(waterText) || 0) + ml)}
                className="rounded-xl bg-sand px-2 py-2 text-xs font-semibold text-plum-dark"
                data-testid={`water-add-${ml}`}
              >
                +{ml} ml
              </button>
            ))}
          </div>
          <button onClick={() => saveWater()} className="mt-2 w-full rounded-2xl bg-sage-deep py-3 text-sm font-semibold text-white" data-testid="water-save">
            {copy.wellness.saveWater}
          </button>
          <div className="mt-4 rounded-2xl bg-cream-bg p-3" data-testid="water-consistency-summary">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-40">{copy.wellness.water.consistencyTitle}</h3>
            <p className="mt-1 text-sm font-semibold text-plum-dark">
              {copy.wellness.water.goalDaysSummary(waterGoalDays, waterTotalDays, copy.progress.periods[period])}
            </p>
            <p className="mt-1 text-xs text-ink-40">{copy.wellness.water.consistencyHelper}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label={copy.wellness.water.goalHitRate} value={`${waterConsistencyPct}%`} />
              <Metric label={copy.wellness.water.dailyAverage} value={formatAmountWithUnit(waterAverageMl, 'ml', language)} />
            </div>
            <WaterConsistencyChart data={waterConsistencyChartData} language={language} copy={copy} />
          </div>
          <HistoryChart data={waterChartData} unit="ml" goal={settings.waterGoalMl} language={language} testId="water-amount-history-chart" />
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-sage-primary/15 text-sage-deep">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-plum-dark">{title}</h2>
        <p className="text-xs text-ink-40">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-sand/40 px-3 py-3 text-center">
      <p className="text-lg font-semibold text-plum-dark font-mono-num">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-40">{label}</p>
    </div>
  );
}

function HistoryChart({
  data,
  unit,
  goal,
  language,
  testId = 'wellness-history-chart',
}: {
  data: ChartPoint[];
  unit: string;
  goal: number;
  language: 'en' | 'he';
  testId?: string;
}) {
  return (
    <div className="mt-4 h-44" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={data.length > 30 ? '35%' : '20%'}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D2" vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 10, fill: '#8F7F90' }}
            tickLine={false}
            interval={chartTickInterval(data.length)}
            minTickGap={8}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8F7F90' }}
            tickLine={false}
            width={42}
            tickFormatter={(value: number) => axisValue(value, unit)}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #EFE4D2', fontSize: 12 }}
            formatter={(value: number) => [unit ? formatAmountWithUnit(value, unit, language) : value.toLocaleString(), '']}
          />
          <ReferenceLine y={goal} stroke="#E8876A" strokeWidth={1.5} strokeDasharray="4 4" />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={chartBarSize(data.length)}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={!entry.hasEntry ? '#EFE4D2' : entry.value >= goal ? '#5C7A58' : '#D8C6B0'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WaterConsistencyChart({
  data,
  language,
  copy,
}: {
  data: WaterConsistencyPoint[];
  language: 'en' | 'he';
  copy: ReturnType<typeof useI18n>['copy'];
}) {
  return (
    <div className="mt-4 h-36" data-testid="water-consistency-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={data.length > 30 ? '35%' : '20%'}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D2" vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 10, fill: '#8F7F90' }}
            tickLine={false}
            interval={chartTickInterval(data.length)}
            minTickGap={8}
          />
          <YAxis hide domain={[0, 1]} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #EFE4D2', fontSize: 12 }}
            formatter={(_, __, item) => [
              item?.payload?.state === 'reached'
                ? copy.wellness.water.reachedGoal
                : item?.payload?.state === 'missed'
                ? copy.wellness.water.missedGoal
                : copy.wellness.water.notLogged,
              formatAmountWithUnit(item?.payload?.value ?? 0, 'ml', language),
            ]}
          />
          <Bar dataKey="status" radius={[8, 8, 0, 0]} maxBarSize={chartBarSize(data.length)}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={
                  entry.state === 'reached'
                    ? '#5C7A58'
                    : entry.state === 'missed'
                    ? '#E8B84F'
                    : '#EFE4D2'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-ink-40">
        <LegendDot color="#5C7A58" label={copy.wellness.water.reachedGoal} />
        <LegendDot color="#E8B84F" label={copy.wellness.water.missedGoal} />
        <LegendDot color="#EFE4D2" label={copy.wellness.water.notLogged} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  );
}
