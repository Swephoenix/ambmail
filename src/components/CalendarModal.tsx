'use client';

import { X } from 'lucide-react';
import CalendarView from '@/components/CalendarView';

type CalendarModalProps = {
  onClose: () => void;
};

export default function CalendarModal({ onClose }: CalendarModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-500 shadow-sm transition hover:text-slate-800"
          aria-label="Close calendar"
        >
          <X size={18} />
        </button>
        <div className="max-h-[90vh] overflow-y-auto">
          <CalendarView mode="modal" />
        </div>
      </div>
    </div>
  );
}
