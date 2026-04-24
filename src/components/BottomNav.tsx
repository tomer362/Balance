import { NavLink } from 'react-router-dom';
import { Home, Search, Camera, ShoppingCart, User } from 'lucide-react';

const tabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/log', icon: Search, label: 'Meals' },
  { to: '/groceries', icon: ShoppingCart, label: 'Grocery' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-cream-card border-t border-sand z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center h-16 relative">
        {/* First two tabs */}
        <div className="flex flex-1">
          {tabs.slice(0, 2).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  isActive ? 'text-sage-deep' : 'text-ink-40'
                }`
              }
            >
              <Icon size={22} strokeWidth={1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Center FAB: Scanner */}
        <div className="flex-none flex items-center justify-center w-20">
          <NavLink
            to="/scan"
            className="w-14 h-14 bg-coral-accent rounded-full flex items-center justify-center shadow-lg -mt-5 transition-transform active:scale-95"
          >
            <Camera size={26} className="text-white" strokeWidth={2} />
          </NavLink>
        </div>

        {/* Last two tabs */}
        <div className="flex flex-1">
          {tabs.slice(2).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  isActive ? 'text-sage-deep' : 'text-ink-40'
                }`
              }
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
