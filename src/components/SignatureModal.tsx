'use client';

import { useState, useEffect } from 'react';
import TiptapEditor from './TiptapEditor';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signature: string, senderName: string) => void;
  initialSignature: string;
  initialSenderName: string;
}

export default function SignatureModal({
  isOpen,
  onClose,
  onSave,
  initialSignature,
  initialSenderName
}: SignatureModalProps) {
  const [signature, setSignature] = useState(initialSignature);
  const [senderName, setSenderName] = useState(initialSenderName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSignature(initialSignature);
      setSenderName(initialSenderName);
    }
  }, [isOpen, initialSignature, initialSenderName]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(signature, senderName);
      onClose();
    } catch (error) {
      console.error('Error saving signature:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Redigera signatur</h2>
          <p className="text-gray-600 mt-1">Anpassa din e-postsignatur för detta konto</p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <TiptapEditor
            value={signature}
            onChange={setSignature}
            placeholder="Skriv din signatur här..."
          />
          <div className="mt-6 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Avsandare</h3>
            <p className="text-xs text-gray-500 mt-1">
              Namnet visas i fran-faltet hos mottagaren.
            </p>
            <input
              type="text"
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
              placeholder="T.ex. Anna Svensson"
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Sparar...' : 'Spara signatur'}
          </button>
        </div>
      </div>
    </div>
  );
}
