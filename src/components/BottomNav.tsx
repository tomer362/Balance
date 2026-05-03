import { NavLink } from 'react-router-dom';
import { Home, Search, ShoppingCart, User } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export default function BottomNav() {
  const { copy } = useI18n();
  const tabs = [
    { to: '/', icon: Home, label: copy.nav.home, testId: 'nav-home' },
    { to: '/log', icon: Search, label: copy.nav.meals, testId: 'nav-log' },
    { to: '/groceries', icon: ShoppingCart, label: copy.nav.grocery, testId: 'nav-groceries' },
    { to: '/profile', icon: User, label: copy.nav.profile, testId: 'nav-profile' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-cream-card border-t border-sand z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="bottom-nav"
    >
      <div className="grid grid-cols-4 h-16">
        {tabs.map(({ to, icon: Icon, label, testId }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            data-testid={testId}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                isActive ? 'text-sage-deep' : 'text-ink-40'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
