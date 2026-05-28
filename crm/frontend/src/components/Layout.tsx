import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { initials } from '../lib/format';
import { fetchMyTasks } from '../lib/tasks';
import OfflineBanner from './OfflineBanner';

const NAV_ITEMS: { to: string; label: string; key: string }[] = [
  { to: '/', label: 'Dashboard', key: 'dashboard' },
  { to: '/contacts', label: 'Contacts', key: 'contacts' },
  { to: '/pipeline', label: 'Pipeline', key: 'pipeline' },
  { to: '/tasks', label: 'Tasks', key: 'tasks' },
  { to: '/imports', label: 'Imports', key: 'imports' },
  { to: '/settings', label: 'Settings', key: 'settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const myTasksQuery = useQuery({
    queryKey: ['my-tasks', { all: false }],
    queryFn: () => fetchMyTasks(false),
    enabled: Boolean(user),
  });

  const overdueCount = useMemo(() => myTasksQuery.data?.overdue.length ?? 0, [myTasksQuery.data]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className={`${
          mobileOpen ? 'block' : 'hidden'
        } md:block fixed inset-y-0 left-0 z-40 w-60 bg-slate-900 text-slate-100 md:static md:flex-shrink-0`}
      >
        <div className="h-14 flex items-center px-4 border-b border-slate-800">
          <Link to="/" className="font-semibold text-white">
            Tax CRM
          </Link>
        </div>
        <nav className="p-2 space-y-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span>{item.label}</span>
              {item.key === 'tasks' && overdueCount > 0 && (
                <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {overdueCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <button
            type="button"
            className="md:hidden rounded p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current" />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                {initials(user?.name)}
              </span>
              <span className="text-sm text-slate-700">{user?.name}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </header>

        <OfflineBanner />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
