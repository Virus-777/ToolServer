const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getUser = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const setUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Use the proxy in development, or direct API URL in production
const API_BASE = import.meta.env.DEV 
  ? '/api'  // Vite proxy will handle this
  : `https://${window.location.hostname}/api`;

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      removeToken();
      throw new Error('Session expired. Please login again.');
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: text || 'An error occurred' };
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || 'An error occurred');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export const AdminAuthAPI = {
  async register(name, email, password, confirm_password) {
    return apiRequest('/admin/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, confirm_password }),
      skipAuth: true,
    });
  },

  async login(email, password) {
    const data = await apiRequest('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });

    if (data.token) {
      setToken(data.token);
      setUser(data.user);
    }

    return data;
  },

  async verify() {
    return apiRequest('/admin/verify');
  },

  logout() {
    removeToken();
  },
};

export const UsersAPI = {
  async getAll() {
    return apiRequest('/auth/');
  },

  async getById(id) {
    return apiRequest(`/auth/${id}`);
  },

  async update(id, name, email, registration_ip) {
    return apiRequest(`/auth/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, email, registration_ip }),
    });
  },

  async delete(id) {
    return apiRequest(`/auth/${id}`, {
      method: 'DELETE',
    });
  },

  async toggleBlock(id, blocked) {
    return apiRequest(`/auth/${id}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked }),
    });
  },
};

export const GPTAPI = {
  async getAvailableModels() {
    return apiRequest('/gpt/models');
  },

  async getSelectedModel() {
    return apiRequest('/gpt/selected');
  },

  async setSelectedModel(modelId) {
    return apiRequest('/gpt/selected', {
      method: 'POST',
      body: JSON.stringify({ modelId }),
    });
  },

  async getApiKey() {
    return apiRequest('/gpt/apikey');
  },

  async saveApiKey(apiKey) {
    return apiRequest('/gpt/apikey', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  },
};

export const ConfigAPI = {
  async getAllConfigs() {
    return apiRequest('/config/all', { skipAuth: true });
  },

  async getConfig(userEmail) {
    return apiRequest(`/config/${encodeURIComponent(userEmail)}`, { skipAuth: true });
  },

  async getPrompt(userEmail) {
    return apiRequest(`/config/prompt/${encodeURIComponent(userEmail)}`, { skipAuth: true });
  },

  async getResume(userEmail) {
    return apiRequest(`/config/resume/${encodeURIComponent(userEmail)}`, { skipAuth: true });
  },

  async getTemplate(userEmail) {
    return apiRequest(`/config/template/${encodeURIComponent(userEmail)}`, { skipAuth: true });
  },

  async getFolder(userEmail) {
    return apiRequest(`/config/folder/${encodeURIComponent(userEmail)}`, { skipAuth: true });
  },

  async delete(userEmail) {
    return apiRequest(`/config/${encodeURIComponent(userEmail)}`, {
      method: 'DELETE',
    });
  },
};

export const JobsAPI = {
  async getAll(date = null, page = 1, limit = 20, search = null, orderDirection = 'ASC') {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (search) params.append('search', search);
    params.append('page', page);
    params.append('limit', limit);
    params.append('orderDirection', orderDirection);

    const url = `/jobs/?${params.toString()}`;
    return apiRequest(url, { skipAuth: true });
  },

  async getById(id) {
    return apiRequest(`/jobs/${id}`, { skipAuth: true });
  },

  async create(id, title, company, date, tech, url, description) {
    return apiRequest('/jobs/', {
      method: 'POST',
      body: JSON.stringify({ id, title, company, date, tech, url, description }),
      skipAuth: true,
    });
  },

  async update(id, title, company, date, tech, url, description) {
    return apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, company, date, tech, url, description }),
      skipAuth: true,
    });
  },

  async delete(id) {
    return apiRequest(`/jobs/${id}`, {
      method: 'DELETE',
      skipAuth: true,
    });
  },
};

export const BlockListAPI = {
  async getAll() {
    return apiRequest('/block-list/');
  },

  async getById(id) {
    return apiRequest(`/block-list/${id}`);
  },

  async create(company_name, url) {
    return apiRequest('/block-list/', {
      method: 'POST',
      body: JSON.stringify({ company_name, url }),
    });
  },

  async update(id, company_name, url) {
    return apiRequest(`/block-list/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ company_name, url }),
    });
  },

  async delete(id) {
    return apiRequest(`/block-list/${id}`, {
      method: 'DELETE',
    });
  },
};

export const HistoryAPI = {
  async getAll(page = 1, limit = 50, user_id = null, action_type = null, entity_type = null) {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', limit);
    if (user_id) params.append('user_id', user_id);
    if (action_type) params.append('action_type', action_type);
    if (entity_type) params.append('entity_type', entity_type);

    const url = `/history/?${params.toString()}`;
    return apiRequest(url);
  },

  async getById(id) {
    return apiRequest(`/history/${id}`);
  },
};

export const AllowedEmailAPI = {
  async getAll() {
    return apiRequest('/allowed-emails/');
  },

  async getById(id) {
    return apiRequest(`/allowed-emails/${id}`);
  },

  async create(email) {
    return apiRequest('/allowed-emails/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async update(id, email) {
    return apiRequest(`/allowed-emails/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ email }),
    });
  },

  async delete(id) {
    return apiRequest(`/allowed-emails/${id}`, {
      method: 'DELETE',
    });
  },
};

export const AssemblyTokenAPI = {
  async getAll() {
    return apiRequest('/assembly-tokens/');
  },

  async getById(id) {
    return apiRequest(`/assembly-tokens/${id}`);
  },

  async create(user_id, api_key) {
    return apiRequest('/assembly-tokens/', {
      method: 'POST',
      body: JSON.stringify({ user_id, api_key }),
    });
  },

  async update(id, user_id, api_key) {
    return apiRequest(`/assembly-tokens/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ user_id, api_key }),
    });
  },

  async delete(id) {
    return apiRequest(`/assembly-tokens/${id}`, {
      method: 'DELETE',
    });
  },
};