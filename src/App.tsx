import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from './components/BottomNav';
import Dashboard from './routes/Dashboard';
import Scanner from './routes/Scanner';
import Log from './routes/Log';
import Suggestions from './routes/Suggestions';
import Groceries from './routes/Groceries';
import Progress from './routes/Progress';
import Profile from './routes/Profile';
import Onboarding from './routes/Onboarding';
import { useAppStore } from './store/appStore';

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8,  transition: { duration: 0.12, ease: 'easeIn'  } },
};

function AppLayout() {
  const location = useLocation();
  const hideNav = location.pathname === '/scan';

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
            <Route path="/scan" element={<Scanner />} />
            <Route path="/log" element={<Log />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/groceries" element={<Groceries />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      {!hideNav && <BottomNav />}
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
