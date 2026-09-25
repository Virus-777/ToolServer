const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value) => String(value).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. Accepts a Date, timestamp or ISO string. */
export const toISODate = (value) => {
  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const todayISO = () => toISODate(new Date());

/** Shift a date by `days` and return YYYY-MM-DD. */
export const addDaysISO = (days, from = new Date()) => {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

export const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

export const formatDate = (value) => {
  if (!value) return '';
  // Plain YYYY-MM-DD strings must not go through Date(): they would shift by the UTC offset
  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

export const truncate = (text, max) => {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

/** Collapse whitespace/newlines so a value fits into one spreadsheet cell. */
export const singleLine = (text) => (text || '').replace(/\s+/g, ' ').trim();

export const maskSecret = (value) => {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for insecure contexts / older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};
