import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const NAV_ITEMS = [
  { to: '/users', label: 'Users', icon: '👥' },
  { to: '/gpt', label: 'GPT Model', icon: '🤖' },
  { to: '/configs', label: 'User Configs', icon: '⚙️' },
  { to: '/jobs', label: 'Jobs', icon: '💼' },
  { to: '/history', label: 'History', icon: '📜' },
  { to: '/allowed-emails', label: 'Allowed Emails', icon: '✉️' },
  { to: '/assembly-tokens', label: 'Assembly Tokens', icon: '🔑' },
];

/**
 * Navigation rail. Always visible from the `md` breakpoint; on smaller screens
 * it slides in as an overlay controlled by `open` / `onClose`.
 */
const Sidebar = ({ open = false, onClose = () => {} }) => {
  const { user, logout } = useAuth();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-800 text-slate-200 transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        <div className="border-b border-slate-700 p-5">
          <h2 className="text-xl font-bold text-primary">KingMaker</h2>
          <p className="text-sm text-gray-400">Admin Dashboard</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `mb-1 flex items-center rounded-lg px-4 py-3 transition-colors ${
                  isActive ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-700'
                }`
              }
            >
              <span className="mr-3 text-xl" aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="border-t border-slate-700 p-4">
            <div className="mb-3 flex items-center">
              <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-xl" aria-hidden="true">
                👤
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={user.email}>{user.name || user.email}</p>
                {user.name && <p className="truncate text-xs text-gray-400" title={user.email}>{user.email}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
