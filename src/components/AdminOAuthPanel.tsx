'use client';

import { useState } from 'react';

type AdminOAuthPanelProps = {
  initialSource: 'env' | 'runtime' | 'missing';
  initialClientId: string;
};

export default function AdminOAuthPanel({ initialSource, initialClientId }: AdminOAuthPanelProps) {
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState('');
  const [source, setSource] = useState(initialSource);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const saveOAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Ange både Client Identifier och Secret key.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/nextcloud/oauth-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error || 'Kunde inte spara OAuth2-inställningar.');
        return;
      }

      setSource('runtime');
      setClientSecret('');
      setMessage('OAuth2-inställningar sparade.');
    } catch {
      setError('Nätverksfel vid sparning av OAuth2-inställningar.');
    } finally {
      setIsSaving(false);
    }
  };

  const logoutPanel = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/panel-auth', { method: 'DELETE' });
      window.location.reload();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">OAuth2 Adminpanel</h1>
            <p className="mt-1 text-sm text-gray-600">
              Endast tillgänglig för admin. Hantera Nextcloud OAuth2-klient här.
            </p>
          </div>
          <button
            type="button"
            onClick={logoutPanel}
            disabled={isLoggingOut}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoggingOut ? 'Loggar ut...' : 'Lås panel'}
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
          <p>Källa: {source === 'env' ? '.env' : source === 'runtime' ? 'runtime-fil' : 'saknas'}</p>
          <p>Callback URI: <span className="font-mono">http://localhost:3000/api/nextcloud/auth/callback</span></p>
        </div>

        <form className="mt-5 space-y-3" onSubmit={saveOAuth}>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Client Identifier"
          />
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Secret key"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Sparar...' : 'Spara OAuth2-inställningar'}
            </button>
            <a
              href="/api/nextcloud/auth/start"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Testa Nextcloud-login
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
