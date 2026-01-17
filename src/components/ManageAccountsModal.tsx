'use client';

import { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';

type Account = {
  id: string;
  email: string;
  name?: string;
};

interface ManageAccountsModalProps {
  accounts: Account[];
  onClose: () => void;
  onAdd: () => void;
  onDelete: (accountId: string) => Promise<void> | void;
}

export default function ManageAccountsModal({ accounts, onClose, onAdd, onDelete }: ManageAccountsModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (account: Account) => {
    if (!window.confirm(`Ta bort kontot ${account.email}?`)) {
      return;
    }
    setDeletingId(account.id);
    try {
      await onDelete(account.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">Hantera konton</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {accounts.length === 0 ? (
            <div className="text-sm text-gray-500">Inga konton ännu.</div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {account.name || account.email}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{account.email}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(account)}
                    disabled={deletingId === account.id}
                    className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    {deletingId === account.id ? 'Tar bort...' : 'Ta bort'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-blue-700 hover:text-blue-800 border border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
          >
            <Plus size={16} />
            Lägg till konto
          </button>
        </div>
      </div>
    </div>
  );
}
