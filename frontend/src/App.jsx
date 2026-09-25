import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import { LoadingState } from './components/ui';

// Pages are code-split so the initial bundle stays small (the Excel export
// library alone is several hundred kB and only the Jobs page needs it).
const Users = lazy(() => import('./pages/Users'));
const GptSetting = lazy(() => import('./pages/GptSetting'));
const Configs = lazy(() => import('./pages/Configs'));
const Jobs = lazy(() => import('./pages/Jobs'));
const History = lazy(() => import('./pages/History'));
const AllowedEmails = lazy(() => import('./pages/AllowedEmails'));
const AssemblyTokens = lazy(() => import('./pages/AssemblyTokens'));

const FullScreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <LoadingState />
  </div>
);

/** Pages reachable without logging in (jobs + user configs are public by design). */
const PublicLayout = () => (
  <div className="min-h-screen bg-gray-50">
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div>
        <span className="text-lg font-bold text-primary">KingMaker</span>
        <span className="ml-2 text-sm text-gray-500">Public view</span>
      </div>
      <Link to="/login" className="text-sm font-medium text-primary hover:text-primary-dark">
        Admin login →
      </Link>
    </header>
    <main>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/configs" element={<Configs />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </main>
  </div>
);

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever navigation happens
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span className="font-semibold text-gray-900">KingMaker</span>
        </header>

        <main className="min-w-0 flex-1">
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/users" element={<Users />} />
              <Route path="/gpt" element={<GptSetting />} />
              <Route path="/configs" element={<Configs />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/history" element={<History />} />
              <Route path="/allowed-emails" element={<AllowedEmails />} />
              <Route path="/assembly-tokens" element={<AssemblyTokens />} />
              <Route path="*" element={<Navigate to="/users" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return isAuthenticated ? <AdminLayout /> : <PublicLayout />;
};

function App() {
  return (
    <Router>
      <UIProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </UIProvider>
    </Router>
  );
}

export default App;
