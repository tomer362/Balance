import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Dashboard from './routes/Dashboard';
import Scanner from './routes/Scanner';
import Log from './routes/Log';
import Suggestions from './routes/Suggestions';
import Groceries from './routes/Groceries';
import Progress from './routes/Progress';
import Profile from './routes/Profile';

function AppLayout() {
  const location = useLocation();
  const hideNav = location.pathname === '/scan';

  return (
    <div className="min-h-screen bg-cream-bg">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scan" element={<Scanner />} />
        <Route path="/log" element={<Log />} />
        <Route path="/suggestions" element={<Suggestions />} />
        <Route path="/groceries" element={<Groceries />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
