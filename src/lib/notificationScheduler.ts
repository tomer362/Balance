import type { HabitSettings, Profile } from '../store/appStore';

type NotificationCandidate = {
  key: string;
  title: string;
  body: string;
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function minutesFromTime(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function currentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function hasTodayWeight(profile: Profile, today: string): boolean {
  return profile.weightHistory.some((entry) => entry.date === today);
}

function mealsLoggedToday(profile: Profile, today: string): number {
  return profile.foodLog.filter((meal) => meal.timestamp.startsWith(today)).length;
}

function valueForToday(history: Array<{ date: string; value: number }> | undefined, today: string): number {
  return history?.find((entry) => entry.date === today)?.value ?? 0;
}

function dueToday(time: string): boolean {
  const scheduled = minutesFromTime(time);
  return scheduled !== null && currentMinutes() >= scheduled;
}

function candidateKey(today: string, type: string, index = 0): string {
  return `${today}:${type}:${index}`;
}

export function buildNotificationCandidates(
  profile: Profile,
  settings: HabitSettings,
  copy: {
    weight: { title: string; body: string };
    steps: { title: string; body: (remaining: number) => string };
    water: { title: string; body: (remaining: number) => string };
    food: { title: string; body: (mealNumber: number) => string };
  },
): NotificationCandidate[] {
  const today = todayStr();
  const sent = new Set(settings.notifications.sentKeys);
  const candidates: NotificationCandidate[] = [];

  if (dueToday(settings.notifications.weightTime) && !hasTodayWeight(profile, today)) {
    const key = candidateKey(today, 'weight');
    if (!sent.has(key)) {
      candidates.push({ key, title: copy.weight.title, body: copy.weight.body });
    }
  }

  if (dueToday(settings.notifications.stepsTime)) {
    const remaining = Math.max(0, settings.stepGoal - valueForToday(profile.stepHistory, today));
    const key = candidateKey(today, 'steps');
    if (remaining > 0 && !sent.has(key)) {
      candidates.push({ key, title: copy.steps.title, body: copy.steps.body(remaining) });
    }
  }

  const waterToday = valueForToday(profile.waterHistory, today);
  settings.notifications.waterTimes.forEach((time, index, times) => {
    const expected = Math.round(settings.waterGoalMl * ((index + 1) / Math.max(1, times.length)));
    const remaining = Math.max(0, expected - waterToday);
    const key = candidateKey(today, 'water', index);
    if (dueToday(time) && remaining > 0 && !sent.has(key)) {
      candidates.push({ key, title: copy.water.title, body: copy.water.body(remaining) });
    }
  });

  const mealCount = mealsLoggedToday(profile, today);
  settings.notifications.foodTimes.forEach((time, index) => {
    const expectedMeals = index + 1;
    const key = candidateKey(today, 'food', index);
    if (dueToday(time) && mealCount < expectedMeals && !sent.has(key)) {
      candidates.push({ key, title: copy.food.title, body: copy.food.body(expectedMeals) });
    }
  });

  return candidates;
}

export function sendBrowserNotification(title: string, body: string): boolean {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  new Notification(title, {
    body,
    tag: `balance-${title}`,
  });
  return true;
}
