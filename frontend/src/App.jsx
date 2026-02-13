import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Users from './pages/Users';
import GptSetting from './pages/GptSetting';
import Configs from './pages/Configs';
import Jobs from './pages/Jobs';
import History from './pages/History';
import AllowedEmails from './pages/AllowedEmails';
import AssemblyTokens from './pages/AssemblyTokens';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppLayout = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/configs" element={<Configs />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64">
        <Routes>
          <Route path="/users" element={<Users />} />
          <Route path="/gpt" element={<GptSetting />} />
          <Route path="/configs" element={<Configs />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/history" element={<History />} />
          <Route path="/allowed-emails" element={<AllowedEmails />} />
          <Route path="/assembly-tokens" element={<AssemblyTokens />} />
          <Route path="/login" element={<Navigate to="/users" replace />} />
          <Route path="/" element={<Navigate to="/users" replace />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}

export default App;
