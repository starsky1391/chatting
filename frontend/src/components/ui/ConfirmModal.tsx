"use client";
import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative glass rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
        {/* Title */}
        <h3 className="text-xl font-bold gradient-text mb-2">{title}</h3>

        {/* Message */}
        <p className="text-zinc-400 mb-6">{message}</p>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              danger
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'btn-primary text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
