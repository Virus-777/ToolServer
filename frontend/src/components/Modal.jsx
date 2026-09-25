import React, { useEffect, useId, useRef } from 'react';
import { Button } from './ui';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

/**
 * Accessible dialog: closes on Escape / backdrop click, locks body scroll and
 * keeps long content scrollable inside the panel.
 */
export const Modal = ({ isOpen, onClose, title, children, size = 'md', footer }) => {
  const titleId = useId();
  const backdropRef = useRef(null);
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => { mouseDownOnBackdrop.current = event.target === backdropRef.current; }}
      onMouseUp={(event) => {
        // Close only when the click started and ended on the backdrop (not a drag out of the panel)
        if (mouseDownOnBackdrop.current && event.target === backdropRef.current) onClose();
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[90vh] w-full flex-col rounded-lg bg-white shadow-xl ${SIZES[size] || SIZES.md}`}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmModal = ({
  isOpen,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 text-3xl" aria-hidden="true">{danger ? '🗑️' : '⚠️'}</div>
        <h3 id={titleId} className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
        {message && <p className="mb-6 text-sm text-gray-600">{message}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};
