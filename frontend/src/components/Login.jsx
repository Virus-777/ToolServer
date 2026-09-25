import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, FormField, Input } from './ui';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(form.email.trim(), form.password);
      navigate('/users');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Admin Login</h1>
        <p className="mb-6 text-sm text-gray-600">Sign in with an admin account to manage the dashboard.</p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField label="Email" htmlFor="loginEmail">
            <Input
              id="loginEmail"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={form.email}
              onChange={updateField('email')}
              placeholder="admin@example.com"
            />
          </FormField>

          <FormField label="Password" htmlFor="loginPassword">
            <Input
              id="loginPassword"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={updateField('password')}
              placeholder="••••••••"
            />
          </FormField>

          <Button type="submit" className="mt-2 w-full" loading={loading}>
            {loading ? 'Logging in…' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
