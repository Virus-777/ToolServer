import React from 'react';

/**
 * Small design-system primitives shared by every page so spacing, colours and
 * states stay consistent and pages only describe their content.
 */

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export const Spinner = ({ className = 'h-4 w-4' }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export const Button = React.forwardRef(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className = '', type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

const ACTION_COLORS = {
  primary: 'text-blue-600 hover:text-blue-900',
  danger: 'text-red-600 hover:text-red-900',
  success: 'text-green-600 hover:text-green-900',
  warning: 'text-amber-600 hover:text-amber-900',
  neutral: 'text-gray-600 hover:text-gray-900',
};

/** Inline text button used inside table rows. */
export const ActionButton = ({ color = 'primary', className = '', children, ...props }) => (
  <button
    type="button"
    className={`text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_COLORS[color]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Page = ({ children, className = '' }) => (
  <div className={`p-4 sm:p-6 lg:p-8 ${className}`}>{children}</div>
);

export const PageHeader = ({ title, description, actions }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Card = ({ children, className = '' }) => (
  <div className={`rounded-lg bg-white p-6 shadow ${className}`}>{children}</div>
);

const FIELD_BASE =
  'rounded-md border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100';

const FIELD_SIZES = {
  sm: 'px-2 py-1',
  md: 'px-3 py-2',
};

/**
 * Compose the class list for a form control.
 * `fullWidth` is a prop (instead of relying on class overrides) because Tailwind
 * resolves conflicting utilities by stylesheet order, not by class order.
 */
const fieldClassName = ({ size = 'md', fullWidth = true, className = '' }) =>
  `${fullWidth ? 'w-full ' : ''}${FIELD_BASE} ${FIELD_SIZES[size]} ${className}`;

export const Input = React.forwardRef(({ size, fullWidth, className, ...props }, ref) => (
  <input ref={ref} className={fieldClassName({ size, fullWidth, className })} {...props} />
));
Input.displayName = 'Input';

export const Select = React.forwardRef(({ size, fullWidth, className, children, ...props }, ref) => (
  <select ref={ref} className={fieldClassName({ size, fullWidth, className })} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef(({ size, fullWidth, className, ...props }, ref) => (
  <textarea ref={ref} className={fieldClassName({ size, fullWidth, className })} {...props} />
));
Textarea.displayName = 'Textarea';

export const FormField = ({ label, htmlFor, required, hint, children }) => (
  <div className="mb-4">
    {label && (
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
    )}
    {children}
    {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
);

const BADGE_COLORS = {
  gray: 'bg-gray-100 text-gray-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  purple: 'bg-purple-100 text-purple-800',
};

export const Badge = ({ color = 'gray', className = '', children }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[color]} ${className}`}>
    {children}
  </span>
);

/** Muted placeholder for empty cells ("Not set", "No URL", ...). */
export const Placeholder = ({ children = 'Not set' }) => <em className="text-gray-400">{children}</em>;

export const LoadingState = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-3 py-10 text-gray-500">
    <Spinner className="h-5 w-5" />
    <span>{label}</span>
  </div>
);

/**
 * Generic table.
 * columns: [{ key, label, render?(row), className?, headerClassName? }]
 */
export const DataTable = ({ columns, rows, rowKey, loading = false, loadingLabel = 'Loading…', emptyMessage = 'No records found' }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${column.headerClassName || ''}`}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 bg-white">
        {loading ? (
          <tr>
            <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-500">
              <span className="inline-flex items-center gap-2"><Spinner /> {loadingLabel}</span>
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-500">{emptyMessage}</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 text-sm ${column.className || 'whitespace-nowrap text-gray-900'}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export const Tabs = ({ tabs, active, onChange }) => (
  <div className="mb-6 border-b border-gray-200">
    <nav className="-mb-px flex gap-6" aria-label="Tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
          className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
            active === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  </div>
);
