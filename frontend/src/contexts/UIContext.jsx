import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../components/Modal';

/**
 * App-wide UI feedback: non-blocking toasts and a promise-based confirm dialog.
 *
 *   const toast = useToast();      toast.success('Saved');
 *   const confirm = useConfirm();  if (await confirm({ title, message })) { ... }
 */
const UIContext = createContext(null);

const TOAST_STYLES = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

const TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ', warning: '!' };

const ToastStack = ({ toasts, onDismiss }) => (
  <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2" role="status" aria-live="polite">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`toast-enter pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${TOAST_STYLES[toast.type]}`}
      >
        <span className="mt-0.5 font-bold" aria-hidden="true">{TOAST_ICONS[toast.type]}</span>
        <span className="flex-1 break-words">{toast.message}</span>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-lg leading-none opacity-60 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          &times;
        </button>
      </div>
    ))}
  </div>
);

let toastCounter = 0;

export const UIProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((type, message, { duration = 4000 } = {}) => {
    toastCounter += 1;
    const id = toastCounter;
    setToasts((current) => [...current, { id, type, message }]);
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismissToast(id), duration));
    }
    return id;
  }, [dismissToast]);

  useEffect(() => () => timers.current.forEach((timer) => clearTimeout(timer)), []);

  const toast = useMemo(() => ({
    success: (message, options) => pushToast('success', message, options),
    error: (message, options) => pushToast('error', message, { duration: 7000, ...options }),
    info: (message, options) => pushToast('info', message, options),
    warning: (message, options) => pushToast('warning', message, { duration: 6000, ...options }),
    dismiss: dismissToast,
  }), [pushToast, dismissToast]);

  /** Resolves to true when the user confirms, false otherwise. */
  const confirm = useCallback((options) => new Promise((resolve) => {
    setConfirmState({ ...options, resolve });
  }), []);

  const settleConfirm = (result) => {
    if (confirmState) confirmState.resolve(result);
    setConfirmState(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        danger={confirmState?.danger}
        onConfirm={() => settleConfirm(true)}
        onCancel={() => settleConfirm(false)}
      />
    </UIContext.Provider>
  );
};

const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useToast/useConfirm must be used within a UIProvider');
  }
  return context;
};

export const useToast = () => useUI().toast;
export const useConfirm = () => useUI().confirm;
