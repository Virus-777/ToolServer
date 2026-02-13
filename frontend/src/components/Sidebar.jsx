import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-800 text-slate-200 flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <h2 className="text-xl font-bold text-primary">KingMaker</h2>
        <p className="text-sm text-gray-400">Admin Dashboard</p>
      </div>

      <nav className="flex-1 p-4">
        <Link
          to="/users"
          className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
            isActive('/users')
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="mr-3 text-xl">👥</span>
          Users
        </Link>

        <Link
          to="/gpt"
          className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
            isActive('/gpt')
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="mr-3 text-xl">🤖</span>
          GPT Model
        </Link>

        <Link
          to="/configs"
          className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
            isActive('/configs')
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="mr-3 text-xl">⚙️</span>
          User Configs
        </Link>

        <Link
          to="/jobs"
          className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
            isActive('/jobs')
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="mr-3 text-xl">💼</span>
          Jobs
        </Link>

        <Link
          to="/history"
          className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
            isActive('/history')
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="mr-3 text-xl">📜</span>
          History
        </Link>

        <Link
          to="/allowed-emails"
          className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
            isActive('/allowed-emails')
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="mr-3 text-xl">✉️</span>
          Allowed Emails
        </Link>

        <Link
          to="/assembly-tokens"
          className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
            isActive('/assembly-tokens')
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="mr-3 text-xl">🔑</span>
          Assembly Tokens
        </Link>
      </nav>

      {user && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl mr-3">
              👤
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{user.name || user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
