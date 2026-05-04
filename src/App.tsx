import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import BottomNav from './components/BottomNav';
import Dashboard from './routes/Dashboard';
import Log from './routes/Log';
import Suggestions from './routes/Suggestions';
import Groceries from './routes/Groceries';
import Progress from './routes/Progress';
import Profile from './routes/Profile';
import CheatMeals from './routes/CheatMeals';
import Wellness from './routes/Wellness';
import Onboarding from './routes/Onboarding';
import { defaultHabitSettings, useAppStore } from './store/appStore';
import { buildNotificationCandidates, sendBrowserNotification } from './lib/notificationScheduler';

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8,  transition: { duration: 0.12, ease: 'easeIn'  } },
};

function AppLayout() {
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const settings = useAppStore((s) => s.appSettings);
  const profile = useAppStore((s) => s.profiles.find((p) => p.id === s.activeProfileId));
  const setHabitSettings = useAppStore((s) => s.setHabitSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.lang = settings.language;
    root.dir = settings.language === 'he' ? 'rtl' : 'ltr';
    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    metaTheme?.setAttribute('content', settings.theme === 'dark' ? '#17121A' : '#8FA989');
  }, [settings.language, settings.theme]);

  useEffect(() => {
    if (!profile) return;

    const notificationCopy =
      settings.language === 'he'
        ? {
            weight: { title: 'זמן לעדכן משקל', body: 'עדכון קצר שומר את גרף ההתקדמות מדויק.' },
            steps: { title: 'בדיקת צעדים', body: (remaining: number) => `נותרו ${remaining.toLocaleString()} צעדים ליעד היומי.` },
            water: { title: 'תזכורת מים', body: (remaining: number) => `נותרו ${remaining.toLocaleString()} מ"ל לשלב הזה של היום.` },
            food: { title: 'רישום אוכל', body: (mealNumber: number) => `עד עכשיו כדאי להשלים רישום לארוחה ${mealNumber}.` },
          }
        : {
            weight: { title: 'Time to update weight', body: 'A quick check-in keeps your progress chart accurate.' },
            steps: { title: 'Steps check-in', body: (remaining: number) => `${remaining.toLocaleString()} steps left for today.` },
            water: { title: 'Water reminder', body: (remaining: number) => `${remaining.toLocaleString()} ml left for this part of the day.` },
            food: { title: 'Food logging reminder', body: (mealNumber: number) => `Log meal ${mealNumber} when you get a moment.` },
          };

    function tick() {
      if (!profile) return;
      const habitSettings = {
        ...defaultHabitSettings(),
        ...(profile.habitSettings ?? {}),
        reminders: {
          ...defaultHabitSettings().reminders,
          ...(profile.habitSettings?.reminders ?? {}),
        },
        notifications: {
          ...defaultHabitSettings().notifications,
          ...(profile.habitSettings?.notifications ?? {}),
        },
      };

      if (!habitSettings.notifications.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;

      const candidates = buildNotificationCandidates(profile, habitSettings, notificationCopy);
      const sentKeys = candidates
        .filter((candidate) => sendBrowserNotification(candidate.title, candidate.body))
        .map((candidate) => candidate.key);

      if (sentKeys.length > 0) {
        setHabitSettings(profile.id, {
          notifications: {
            ...habitSettings.notifications,
            sentKeys: [...habitSettings.notifications.sentKeys, ...sentKeys].slice(-80),
          },
        });
      }
    }

    tick();
    const interval = window.setInterval(tick, 60000);
    return () => window.clearInterval(interval);
  }, [profile, setHabitSettings, settings.language]);

  return (
    <div className="min-h-screen bg-cream-bg">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={prefersReducedMotion ? undefined : PAGE_VARIANTS}
          initial={prefersReducedMotion ? false : 'initial'}
          animate={prefersReducedMotion ? undefined : 'animate'}
          exit={prefersReducedMotion ? undefined : 'exit'}
          style={{ minHeight: '100dvh' }}
        >
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<Navigate to="/log" replace />} />
            <Route path="/log" element={<Log />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/groceries" element={<Groceries />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/cheat-meals" element={<CheatMeals />} />
            <Route path="/wellness" element={<Wellness />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);

  return (
    <BrowserRouter>
      {hasOnboarded ? <AppLayout /> : <Onboarding />}
    </BrowserRouter>
  );
}
