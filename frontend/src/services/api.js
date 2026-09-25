/**
 * Dashboard API client.
 *
 * Every call goes through `apiRequest`, which attaches the stored token,
 * normalises errors into `ApiError` and signals expired sessions through a
 * window event so the auth context can redirect to the login page.
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/** Fired on `window` when the server rejects the stored session token. */
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

// Same origin by default: the Express server serves both this app and the API
// (Vite proxies /api in development). Override with VITE_API_BASE when needed.
const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');

const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable (private mode) */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  },
};

export const getToken = () => storage.get(TOKEN_KEY);
export const setToken = (token) => storage.set(TOKEN_KEY, token);

export const getUser = () => {
  const raw = storage.get(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
export const setUser = (user) => storage.set(USER_KEY, JSON.stringify(user));

export const removeToken = () => {
  storage.remove(TOKEN_KEY);
  storage.remove(USER_KEY);
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** Serialise an object into a query string, skipping empty values. */
const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.append(key, value);
    }
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }
  const text = await response.text();
  return text ? { error: text } : {};
}

/**
 * @param {string} endpoint  Path relative to the API base, e.g. "/jobs/1"
 * @param {object} [options]
 * @param {boolean} [options.skipAuth]  Do not attach the session token
 * @param {object}  [options.body]      JSON-encoded automatically
 */
async function apiRequest(endpoint, { skipAuth = false, headers = {}, body, ...options } = {}) {
  const token = skipAuth ? null : getToken();
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Unable to reach the server. Please check your connection and try again.', 0);
  }

  const data = await parseBody(response);

  // Only a rejected *session* token means the session expired; a 401 from the
  // login form itself just means bad credentials.
  if (response.status === 401 && token) {
    removeToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError('Your session has expired. Please log in again.', 401, data);
  }

  if (!response.ok) {
    throw new ApiError(data.error || data.message || `Request failed with status ${response.status}`, response.status, data);
  }

  return data;
}

export const AdminAuthAPI = {
  register(name, email, password, confirm_password) {
    return apiRequest('/admin/register', { method: 'POST', body: { name, email, password, confirm_password }, skipAuth: true });
  },

  async login(email, password) {
    const data = await apiRequest('/admin/login', { method: 'POST', body: { email, password }, skipAuth: true });
    if (data.token) {
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  },

  /** Validates the stored token and keeps the refreshed one the server returns. */
  async verify() {
    const data = await apiRequest('/admin/verify');
    if (data.token) setToken(data.token);
    if (data.user) setUser(data.user);
    return data;
  },

  logout() {
    removeToken();
  },
};

export const UsersAPI = {
  getAll: () => apiRequest('/auth/'),
  getById: (id) => apiRequest(`/auth/${id}`),
  update: (id, { name, email, registration_ip }) =>
    apiRequest(`/auth/${id}`, { method: 'PUT', body: { name, email, registration_ip } }),
  delete: (id) => apiRequest(`/auth/${id}`, { method: 'DELETE' }),
  toggleBlock: (id, blocked) => apiRequest(`/auth/${id}/block`, { method: 'PATCH', body: { blocked } }),
};

export const GPTAPI = {
  getAvailableModels: () => apiRequest('/gpt/models'),
  getSelectedModel: () => apiRequest('/gpt/selected'),
  setSelectedModel: (modelId) => apiRequest('/gpt/selected', { method: 'POST', body: { modelId } }),
  getApiKey: () => apiRequest('/gpt/apikey'),
  saveApiKey: (apiKey) => apiRequest('/gpt/apikey', { method: 'POST', body: { apiKey } }),
};

export const ConfigAPI = {
  getAllConfigs: () => apiRequest('/config/all', { skipAuth: true }),
  getConfig: (userEmail) => apiRequest(`/config/${encodeURIComponent(userEmail)}`, { skipAuth: true }),
  getPrompt: (userEmail) => apiRequest(`/config/prompt/${encodeURIComponent(userEmail)}`, { skipAuth: true }),
  getResume: (userEmail) => apiRequest(`/config/resume/${encodeURIComponent(userEmail)}`, { skipAuth: true }),
  getTemplate: (userEmail) => apiRequest(`/config/template/${encodeURIComponent(userEmail)}`, { skipAuth: true }),
  getFolder: (userEmail) => apiRequest(`/config/folder/${encodeURIComponent(userEmail)}`, { skipAuth: true }),
  delete: (userEmail) => apiRequest(`/config/${encodeURIComponent(userEmail)}`, { method: 'DELETE', skipAuth: true }),
};

/** Writable job fields sent to the API. */
const pickJobFields = ({ title, company, date, tech, url, summary, description, industry }) => ({
  title,
  company,
  date,
  tech,
  url,
  summary,
  description,
  industry,
});

export const JobsAPI = {
  /**
   * @param {object} filters { date, page, limit, search, orderDirection, industry }
   */
  getAll: ({ date, page = 1, limit = 20, search, orderDirection = 'ASC', industry } = {}) =>
    apiRequest(`/jobs${buildQuery({ date, search, industry, page, limit, orderDirection })}`, { skipAuth: true }),
  getById: (id) => apiRequest(`/jobs/${id}`, { skipAuth: true }),
  create: (job) => apiRequest('/jobs', { method: 'POST', body: pickJobFields(job), skipAuth: true }),
  update: (id, job) => apiRequest(`/jobs/${id}`, { method: 'PUT', body: pickJobFields(job), skipAuth: true }),
  delete: (id) => apiRequest(`/jobs/${id}`, { method: 'DELETE', skipAuth: true }),
  deleteByDate: (date) => apiRequest(`/jobs/by-date${buildQuery({ date })}`, { method: 'DELETE', skipAuth: true }),
};

export const BlockListAPI = {
  getAll: () => apiRequest('/block-list/'),
  getById: (id) => apiRequest(`/block-list/${id}`),
  create: (company_name, url) => apiRequest('/block-list/', { method: 'POST', body: { company_name, url } }),
  update: (id, company_name, url) => apiRequest(`/block-list/${id}`, { method: 'PUT', body: { company_name, url } }),
  delete: (id) => apiRequest(`/block-list/${id}`, { method: 'DELETE' }),
};

export const HistoryAPI = {
  /**
   * @param {object} filters { page, limit, user_id, action_type, entity_type }
   */
  getAll: ({ page = 1, limit = 50, user_id, action_type, entity_type } = {}) =>
    apiRequest(`/history${buildQuery({ page, limit, user_id, action_type, entity_type })}`),
  getById: (id) => apiRequest(`/history/${id}`),
};

export const AllowedEmailAPI = {
  getAll: () => apiRequest('/allowed-emails/'),
  getById: (id) => apiRequest(`/allowed-emails/${id}`),
  create: (email) => apiRequest('/allowed-emails/', { method: 'POST', body: { email } }),
  update: (id, email) => apiRequest(`/allowed-emails/${id}`, { method: 'PUT', body: { email } }),
  delete: (id) => apiRequest(`/allowed-emails/${id}`, { method: 'DELETE' }),
};

export const AssemblyTokenAPI = {
  getAll: () => apiRequest('/assembly-tokens/'),
  getById: (id) => apiRequest(`/assembly-tokens/${id}`),
  create: (user_id, api_key) => apiRequest('/assembly-tokens/', { method: 'POST', body: { user_id, api_key } }),
  update: (id, user_id, api_key) => apiRequest(`/assembly-tokens/${id}`, { method: 'PUT', body: { user_id, api_key } }),
  delete: (id) => apiRequest(`/assembly-tokens/${id}`, { method: 'DELETE' }),
};
