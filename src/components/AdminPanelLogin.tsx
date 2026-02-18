'use client';

import { useState } from 'react';

type AdminPanelLoginProps = {
  secretConfigured: boolean;
};

export default function AdminPanelLogin({ secretConfigured }: AdminPanelLoginProps) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!secretConfigured) {
      setError('ADMIN_PANEL_SECRET saknas i serverns .env.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/panel-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Kunde inte logga in i adminpanelen.');
        return;
      }
      window.location.reload();
    } catch {
      setError('Nätverksfel vid inloggning.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <h1 className="text-xl font-semibold text-gray-900">Adminpanel</h1>
        <p className="mt-2 text-sm text-gray-600">
          Ange admin-lösenord för att konfigurera OAuth2.
        </p>
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Admin-lösenord"
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Verifierar...' : 'Öppna adminpanel'}
          </button>
        </form>
      </div>
    </main>
  );
}
