"use client";

import { useEffect, useRef, useCallback } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center"
      onClick={(e) => {
        if (e.target === overlayRef.current || e.target === backdropRef.current) onClose();
      }}
    >
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-[modalBackdropIn_0.2s_ease-out]"
      />
      <div className="relative bg-white w-full lg:max-w-lg lg:rounded-lg rounded-t-lg max-h-[85vh] flex flex-col shadow-lg border border-gray-200 animate-[modalSheetIn_0.25s_ease-out] lg:animate-[modalContentIn_0.2s_ease-out]">
        <div className="border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 lg:p-1.5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 px-4 lg:px-6 py-4 bg-white rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
