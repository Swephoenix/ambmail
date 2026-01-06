'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import ComposeEmail from '@/components/ComposeEmail';

function ComposeContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (draftId) {
      const saved = localStorage.getItem(`draft_${draftId}`);
      if (saved) {
        setInitialData(JSON.parse(saved));
        // Optional: clear it after loading, or keep it to allow refresh
        // localStorage.removeItem(`draft_${draftId}`);
      }
    }
    setLoading(false);
  }, [draftId]);

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50">Loading...</div>;

  if (!initialData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        Draft not found or expired.
      </div>
    );
  }

  return (
    <ComposeEmail
      mode="standalone"
      windowId={`standalone-${Date.now()}`}
      accountId={initialData.accountId}
      onClose={() => window.close()}
      onMinimize={() => {}} // No-op for standalone windows
      onRestore={() => {}} // No-op for standalone windows
      initialData={initialData}
    />
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-gray-50">Loading...</div>}>
      <ComposeContent />
    </Suspense>
  );
}
