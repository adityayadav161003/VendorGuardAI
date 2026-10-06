import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '/', label: 'Focus Supplier Search Switcher' },
  { key: 'j', label: 'Navigate to Next Supplier' },
  { key: 'k', label: 'Navigate to Previous Supplier' },
  { key: 'r', label: 'Re-run Analysis on Active Supplier' },
  { key: 'e', label: 'Export Print-Ready PDF / HTML Report' },
  { key: '?', label: 'Open Keyboard Shortcuts Cheat Sheet' },
  { key: 'Esc', label: 'Close Active Modal or Audit Drawer' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-espresso/60 backdrop-blur-xs transition-opacity animate-fade"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-cream-50 rounded-2xl shadow-2xl border border-cream-300 p-6 z-10 animate-scale-in space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-cream-300">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-espresso flex items-center justify-center text-brass-light">
              <Keyboard className="w-4 h-4" />
            </span>
            <h3 className="font-display text-lg font-semibold text-espresso">
              Keyboard Shortcuts Cheat Sheet
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stonewarm hover:text-espresso hover:bg-cream-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {SHORTCUTS.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-linen border border-cream-300 text-xs"
            >
              <span className="text-espresso font-medium">{item.label}</span>
              <kbd className="px-2.5 py-1 rounded-md bg-cream-200 border border-cream-400 font-mono font-bold text-brown-800 text-[11px] shadow-xs">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center">
          <button onClick={onClose} className="btn-primary w-full !text-xs">
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
