import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Droplets, Dumbbell, Footprints } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { defaultHabitSettings, selectActiveProfile, useAppStore } from '../store/appStore';
import type { DatedNumberLog } from '../store/appStore';
import { directionalIconClass, formatAmountWithUnit, formatDateValue, useI18n } from '../lib/i18n';

type Period = 'week' | 'month' | '3m';

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

function chartData(history: DatedNumberLog[] | undefined, period: Period, language: 'en' | 'he') {
  const days = periodDays(period);
  const start = addDays(new Date(), -(days - 1));
  const values = new Map((history ?? []).map((entry) => [entry.date, entry.value]));

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const key = isoDate(date);
    return {
      date: key,
      label: formatDateValue(date, language, { month: 'short', day: 'numeric' }),
      value: values.get(key) ?? 0,
    };
  });
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
  const [stepsText, setStepsText] = useState('');
  const [waterDate, setWaterDate] = useState(todayStr());
  const [waterText, setWaterText] = useState('');
  const [period, setPeriod] = useState<Period>('week');

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

  const stepChartData = useMemo(() => chartData(profile?.stepHistory, period, language), [profile?.stepHistory, period, language]);
  const waterChartData = useMemo(() => chartData(profile?.waterHistory, period, language), [profile?.waterHistory, period, language]);

  useEffect(() => {
    const section = searchParams.get('section');
    const target = section === 'workouts' ? workoutsRef : section === 'water' ? waterRef : section === 'steps' ? stepsRef : null;
    if (target) {
      requestAnimationFrame(() => target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [searchParams]);

  useEffect(() => {
    setStepsText(String(logValue(profile?.stepHistory, stepsDate) || ''));
  }, [profile?.stepHistory, stepsDate]);

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

  function saveSteps() {
    const parsed = Number(stepsText);
    if (!Number.isFinite(parsed)) return;
    logSteps(profile!.id, stepsDate, parsed);
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
            <input
              type="number"
              inputMode="numeric"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={copy.wellness.steps.placeholder}
              className="rounded-xl border border-sand bg-cream-bg px-3 py-2 text-sm text-plum-dark"
              data-testid="steps-input"
            />
          </div>
          <button onClick={saveSteps} className="mt-2 w-full rounded-2xl bg-sage-deep py-3 text-sm font-semibold text-white" data-testid="steps-save">
            {copy.wellness.saveSteps}
          </button>
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
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold ${workoutDoneToday ? 'bg-sage-deep text-white' : 'bg-sand text-plum-dark'}`}
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
          <HistoryChart data={waterChartData} unit="ml" goal={settings.waterGoalMl} language={language} />
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
}: {
  data: Array<{ date: string; label: string; value: number }>;
  unit: string;
  goal: number;
  language: 'en' | 'he';
}) {
  return (
    <div className="mt-4 h-44" data-testid="wellness-history-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D2" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8F7F90' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#8F7F90' }} tickLine={false} width={42} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #EFE4D2', fontSize: 12 }}
            formatter={(value: number) => [unit ? formatAmountWithUnit(value, unit, language) : value.toLocaleString(), '']}
          />
          <Line type="monotone" dataKey="value" stroke="#5C7A58" strokeWidth={2.5} dot={{ r: 2.5, fill: '#5C7A58' }} />
          <Line type="monotone" dataKey={() => goal} stroke="#E8876A" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
