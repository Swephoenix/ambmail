'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState, Suspense } from 'react';
import ComposeEmail from '@/components/ComposeEmail';

type DraftInitialData = {
  accountId: string;
  to?: string;
  subject?: string;
  body?: string;
  uid?: number;
};

function ComposeContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');
  const [windowId] = useState(() => `standalone-${Date.now()}`);
  const initialData = useMemo<DraftInitialData | null>(() => {
    if (!draftId || typeof window === 'undefined') {
      return null;
    }
    const saved = localStorage.getItem(`draft_${draftId}`);
    if (!saved) return null;
    try {
      return JSON.parse(saved) as DraftInitialData;
    } catch {
      return null;
    }
  }, [draftId]);

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
      windowId={windowId}
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
