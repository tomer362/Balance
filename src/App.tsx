import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
import { useAppStore } from './store/appStore';

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8,  transition: { duration: 0.12, ease: 'easeIn'  } },
};

function AppLayout() {
  const location = useLocation();
  const settings = useAppStore((s) => s.appSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.lang = settings.language;
    root.dir = settings.language === 'he' ? 'rtl' : 'ltr';
    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    metaTheme?.setAttribute('content', settings.theme === 'dark' ? '#17121A' : '#8FA989');
  }, [settings.language, settings.theme]);

  return (
    <div className="min-h-screen bg-cream-bg">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={PAGE_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ minHeight: '100vh' }}
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
