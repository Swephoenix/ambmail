'use client';

import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface AddAccountModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAccountModal({ onClose, onSuccess }: AddAccountModalProps) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      email: '',
      password: '',
      name: '',
      imapHost: 'mailcluster.oderland.com',
      imapPort: 993,
      smtpHost: 'mailcluster.oderland.com',
      smtpPort: 465,
    }
  });

  const onSubmit = async (data: unknown) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add account');
      }

      toast.success('Account added successfully');
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">Add Email Account</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input {...register('name')} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Work" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input {...register('email', { required: true })} type="email" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="name@domain.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input {...register('password', { required: true })} type="password" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">IMAP Host</label>
              <input {...register('imapHost')} className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">IMAP Port</label>
              <input {...register('imapPort')} type="number" className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SMTP Host</label>
              <input {...register('smtpHost')} className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SMTP Port</label>
              <input {...register('smtpPort')} type="number" className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm" />
            </div>
          </div>

          <div className="pt-4">
            <button
              disabled={isSubmitting}
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Connecting...' : 'Connect Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
