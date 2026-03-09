'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Sidebar, { Account } from '@/components/Sidebar';
import MailList, { EmailHeader, LabelOption } from '@/components/MailList';
import MailView from '@/components/MailView';

// Lazy load modal and compose components for better initial load performance
const AddAccountModal = lazy(() => import('@/components/AddAccountModal'));
const ComposeEmail = lazy(() => import('@/components/ComposeEmail'));
const SignatureModal = lazy(() => import('@/components/SignatureModal'));
const ManageAccountsModal = lazy(() => import('@/components/ManageAccountsModal'));
const CalendarModal = lazy(() => import('@/components/CalendarModal'));
import toast from 'react-hot-toast';
import { PenSquare } from 'lucide-react';
import Image from 'next/image';

type LabelDefinition = {
  id: string;
  name: string;
  color: string;
};

const LABEL_COLOR_OPTIONS = [
  { key: 'red', name: 'Rod', hex: '#DC2626', text: '#7F1D1D' },
  { key: 'amber', name: 'Amber', hex: '#D97706', text: '#78350F' },
  { key: 'orange', name: 'Orange', hex: '#EA580C', text: '#7C2D12' },
  { key: 'yellow', name: 'Gul', hex: '#CA8A04', text: '#713F12' },
  { key: 'lime', name: 'Lime', hex: '#65A30D', text: '#365314' },
  { key: 'green', name: 'Grön', hex: '#16A34A', text: '#14532D' },
  { key: 'emerald', name: 'Smaragd', hex: '#059669', text: '#064E3B' },
  { key: 'teal', name: 'Teal', hex: '#0D9488', text: '#134E4A' },
  { key: 'cyan', name: 'Cyan', hex: '#0891B2', text: '#164E63' },
  { key: 'sky', name: 'Sky', hex: '#0284C7', text: '#0C4A6E' },
  { key: 'blue', name: 'Bla', hex: '#2563EB', text: '#1E3A8A' },
  { key: 'indigo', name: 'Indigo', hex: '#4F46E5', text: '#312E81' },
  { key: 'violet', name: 'Violett', hex: '#7C3AED', text: '#4C1D95' },
  { key: 'purple', name: 'Lila', hex: '#9333EA', text: '#581C87' },
  { key: 'fuchsia', name: 'Fuchsia', hex: '#C026D3', text: '#701A75' },
  { key: 'pink', name: 'Rosa', hex: '#DB2777', text: '#831843' },
  { key: 'rose', name: 'Rose', hex: '#E11D48', text: '#881337' },
  { key: 'slate', name: 'Skiffer', hex: '#475569', text: '#0F172A' },
  { key: 'stone', name: 'Sten', hex: '#78716C', text: '#292524' },
  { key: 'gray', name: 'Gra', hex: '#6B7280', text: '#1F2937' },
];

const isHexColor = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);

const pickTextColor = (hex: string) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#ffffff';
};

const getLabelColorOption = (color: string) => {
  const match = LABEL_COLOR_OPTIONS.find(option => option.key === color || option.hex.toLowerCase() === color.toLowerCase());
  if (match) return match;
  if (isHexColor(color)) {
    return { key: color, name: color, hex: color, text: pickTextColor(color) };
  }
  return LABEL_COLOR_OPTIONS[LABEL_COLOR_OPTIONS.length - 1];
};

const getNextAvailableColor = (usedColors: Set<string>) => {
  const next = LABEL_COLOR_OPTIONS.find(option => !usedColors.has(option.hex.toUpperCase()));
  return next ? next.hex : LABEL_COLOR_OPTIONS[0].hex;
};

const ACCOUNTS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const EMAIL_LIST_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes


export default function Home() {
  type SelectedEmail = EmailHeader & {
    accountId?: string;
    folder?: string;
    [key: string]: unknown;
  };

  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; name: string; email?: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>('INBOX');
  const [emails, setEmails] = useState<EmailHeader[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SelectedEmail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingBody, setIsLoadingBody] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageAccounts, setShowManageAccounts] = useState(false);
  const [composeWindows, setComposeWindows] = useState<Array<{
    id: string;
    accountId: string;
    initialData?: { to: string; subject: string; body: string; uid?: number };
    minimized: boolean;
  }>>([]);
  // Multi-select state
  const [selectedEmails, setSelectedEmails] = useState<number[]>([]);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; quotaMb: number | null } | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [activeLabelFilter, setActiveLabelFilter] = useState<string | null>(null);
  const [labelDefinitions, setLabelDefinitions] = useState<LabelDefinition[]>([]);
  const [labelEdits, setLabelEdits] = useState<Record<string, { name: string; color: string }>>({});
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLOR_OPTIONS[0].hex);

  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [currentSignatureAccount, setCurrentSignatureAccount] = useState<{
    id: string;
    signature: string;
    senderName: string;
  } | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Cache for accounts to avoid unnecessary API calls
  const [accountsCache, setAccountsCache] = useState<{data: Account[], timestamp: number} | null>(null);

  const labelOptions: LabelOption[] = labelDefinitions.map(label => {
    const color = getLabelColorOption(label.color);
    return {
      name: label.name,
      colorHex: color.hex,
      textHex: color.text,
    };
  });

  const visibleEmails = emails.filter(email => {
    if (showStarredOnly && !(Array.isArray(email.flags) && email.flags.includes('\\Flagged'))) {
      return false;
    }
    if (activeLabelFilter && !(Array.isArray(email.labels) && email.labels.includes(activeLabelFilter))) {
      return false;
    }
    return true;
  });

  // Cache for email lists to avoid unnecessary API calls
  const [emailCache, setEmailCache] = useState<Record<string, {data: EmailHeader[], timestamp: number}>>({});

  const fetchAccounts = useCallback(async (forceRefresh = false) => {
    // Check if we have cached data that's still valid, unless forceRefresh is true
    if (!forceRefresh && accountsCache && (Date.now() - accountsCache.timestamp) < ACCOUNTS_CACHE_DURATION) {
      setAccounts(accountsCache.data);
      if (accountsCache.data.length > 0 && !activeAccountId) {
        setActiveAccountId(accountsCache.data[0].id);
      }
      return accountsCache.data;
    }

    const res = await fetch('/api/accounts');
    if (res.status === 401) {
      setAuthStatus('unauthenticated');
      setCurrentUser(null);
      return [];
    }
    const data = await res.json();
    setAccounts(data);
    setAccountsCache({data, timestamp: Date.now()});

    if (data.length > 0 && !activeAccountId) {
      setActiveAccountId(data[0].id);
    }

    return data;
  }, [accountsCache, activeAccountId]);

  const fetchStorageUsage = async () => {
    try {
      const res = await fetch('/api/mail/usage');
      if (res.status === 401) {
        setStorageUsage(null);
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const usedBytes = Number(data.usedBytes || 0);
      const quotaMb = Number.isFinite(Number(data.quotaMb)) ? Number(data.quotaMb) : null;
      setStorageUsage({ usedBytes, quotaMb });
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
    }
  };

  const fetchLabelDefinitions = async () => {
    try {
      const res = await fetch('/api/mail/labels/definitions');
      if (res.status === 401) {
        setLabelDefinitions([]);
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLabelDefinitions(data);
    } catch (error) {
      console.error('Failed to fetch labels:', error);
    }
  };

  const fetchEmails = useCallback(async (accountId: string, folder: string, forceSync = false) => {
    const cacheKey = `${accountId}-${folder}-list`; // Fixed to 'list' mode only

    // Check if we have cached data that's still valid (including pre-fetched data)
    if (!forceSync && emailCache[cacheKey] && (Date.now() - emailCache[cacheKey].timestamp) < EMAIL_LIST_CACHE_DURATION) {
      setEmails(emailCache[cacheKey].data);
      setIsLoadingList(false);
      return;
    }

    setIsLoadingList(true);
    try {
      // Use encodeURIComponent for folders like "Inbox.Sent" etc if needed
      const res = await fetch(`/api/mail?accountId=${accountId}&folder=${encodeURIComponent(folder)}&view=list&forceSync=${forceSync}`);
      if (res.status === 401) {
        setAuthStatus('unauthenticated');
        setCurrentUser(null);
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmails(data);

      // Cache the result
      setEmailCache(prev => ({
        ...prev,
        [cacheKey]: { data, timestamp: Date.now() }
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch emails';
      toast.error('Failed to fetch emails: ' + message);
      setEmails([]);
    } finally {
      setIsLoadingList(false);
    }
  }, [emailCache]);


  const fetchEmailBody = async (accountId: string, uid: number) => {
    setIsLoadingBody(true);
    try {
      const res = await fetch(`/api/mail/body?accountId=${accountId}&uid=${uid}&folder=${encodeURIComponent(activeFolder)}`);
      if (res.status === 401) {
        setAuthStatus('unauthenticated');
        setCurrentUser(null);
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      data.accountId = accountId;
      data.folder = activeFolder;

      // Check if we are in Drafts folder (using common IDs)
      if (activeFolder === 'Drafts' || activeFolder === 'Utkast') {
        // Add a new compose window for the draft
        const newWindow = {
          id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          accountId: activeAccountId!,
          initialData: {
            to: data.to || '',
            subject: data.subject,
            body: data.body,
            uid: data.uid
          },
          minimized: false
        };

        setComposeWindows(prev => [...prev, newWindow]);
        setSelectedEmail(null);
      } else {
        const listEmail = emails.find(email => email.uid === uid);
        const baseFlags = Array.isArray(listEmail?.flags) ? listEmail?.flags : [];
        const baseLabels = Array.isArray(listEmail?.labels) ? listEmail?.labels : [];
        data.flags = [...new Set([...baseFlags, '\\Seen'])];
        data.labels = baseLabels;
        setSelectedEmail(data);

        // Automatically mark as read in UI
        setEmails(prev => prev.map(email =>
          email.uid === uid ? { ...email, flags: [...new Set([...email.flags, '\\Seen'])] } : email
        ));

        // Mark as read on server (silent)
        fetch('/api/mail/flags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, uid, folder: activeFolder, action: 'add', flag: '\\Seen' }),
        });
      }
    } catch (error: unknown) {
      // If it's a "Message not found" error, try to refresh the email list
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('Message not found')) {
        toast.error('Draft may have been moved or deleted. Refreshing list...');
        // Clear cache for this folder to ensure fresh data
        const cacheKey = `${accountId}-${activeFolder}-list`;
        setEmailCache(prev => {
          const newCache = {...prev};
          delete newCache[cacheKey];
          return newCache;
        });
        // Refresh the current folder to get updated UIDs
        if (accountId) {
          fetchEmails(accountId, activeFolder);
        }
      } else {
        const message = error instanceof Error ? error.message : 'Failed to fetch email body';
        toast.error('Failed to fetch email body: ' + message);
      }
    } finally {
      setIsLoadingBody(false);
    }
  };

  const handleToggleRead = async (uid: number, isRead: boolean) => {
    const action = isRead ? 'remove' : 'add';
    
    // Optimistic UI update
    setEmails(prev => prev.map(email => {
      if (email.uid === uid) {
        const newFlags = isRead
          ? email.flags.filter((f: string) => f !== '\\Seen')
          : [...new Set([...email.flags, '\\Seen'])];
        return { ...email, flags: newFlags };
      }
      return email;
    }));
    setSelectedEmail(prev => {
      if (!prev || prev.uid !== uid) return prev;
      const existingFlags = Array.isArray(prev.flags) ? prev.flags : [];
      const newFlags = isRead
        ? existingFlags.filter((f: string) => f !== '\\Seen')
        : [...new Set([...existingFlags, '\\Seen'])];
      return { ...prev, flags: newFlags };
    });

    try {
      const res = await fetch('/api/mail/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          uid,
          folder: activeFolder,
          action,
          flag: '\\Seen'
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunde inte uppdatera status';
      toast.error('Kunde inte uppdatera status: ' + message);
    }
  };

  const handleToggleStar = async (uid: number, isStarred: boolean) => {
    const action = isStarred ? 'remove' : 'add';

    setEmails(prev => prev.map(email => {
      if (email.uid === uid) {
        const newFlags = isStarred
          ? email.flags.filter((f: string) => f !== '\\Flagged')
          : [...new Set([...email.flags, '\\Flagged'])];
        return { ...email, flags: newFlags };
      }
      return email;
    }));
    setSelectedEmail(prev => {
      if (!prev || prev.uid !== uid) return prev;
      const existingFlags = Array.isArray(prev.flags) ? prev.flags : [];
      const newFlags = isStarred
        ? existingFlags.filter((f: string) => f !== '\\Flagged')
        : [...new Set([...existingFlags, '\\Flagged'])];
      return { ...prev, flags: newFlags };
    });

    try {
      const res = await fetch('/api/mail/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          uid,
          folder: activeFolder,
          action,
          flag: '\\Flagged'
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunde inte uppdatera stjarna';
      toast.error('Kunde inte uppdatera stjarna: ' + message);
    }
  };

  const handleToggleLabel = async (uid: number, label: string, isApplied: boolean) => {
    const action = isApplied ? 'remove' : 'add';

    setEmails(prev => prev.map(email => {
      if (email.uid === uid) {
        const existingLabels = Array.isArray(email.labels) ? email.labels : [];
        const nextLabels = isApplied
          ? existingLabels.filter((item: string) => item !== label)
          : [...new Set([...existingLabels, label])];
        return { ...email, labels: nextLabels };
      }
      return email;
    }));
    setSelectedEmail(prev => {
      if (!prev || prev.uid !== uid) return prev;
      const existingLabels = Array.isArray(prev.labels) ? prev.labels : [];
      const nextLabels = isApplied
        ? existingLabels.filter((item: string) => item !== label)
        : [...new Set([...existingLabels, label])];
      return { ...prev, labels: nextLabels };
    });

    try {
      const res = await fetch('/api/mail/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          uid,
          folder: activeFolder,
          action,
          label
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunde inte uppdatera etikett';
      toast.error('Kunde inte uppdatera etikett: ' + message);
    }
  };

  const applyLabelRename = (previousName: string, nextName: string) => {
    if (previousName === nextName) return;
    setEmails(prev => prev.map(email => {
      if (!Array.isArray(email.labels)) return email;
      if (!email.labels.includes(previousName)) return email;
      const nextLabels = email.labels.map((item: string) => item === previousName ? nextName : item);
      return { ...email, labels: nextLabels };
    }));
    setSelectedEmail(prev => {
      if (!prev || !Array.isArray(prev.labels)) return prev;
      if (!prev.labels.includes(previousName)) return prev;
      return { ...prev, labels: prev.labels.map((item: string) => item === previousName ? nextName : item) };
    });
  };

  const applyLabelRemoval = (labelName: string) => {
    setEmails(prev => prev.map(email => {
      if (!Array.isArray(email.labels)) return email;
      if (!email.labels.includes(labelName)) return email;
      return { ...email, labels: email.labels.filter((item: string) => item !== labelName) };
    }));
    setSelectedEmail(prev => {
      if (!prev || !Array.isArray(prev.labels)) return prev;
      if (!prev.labels.includes(labelName)) return prev;
      return { ...prev, labels: prev.labels.filter((item: string) => item !== labelName) };
    });
  };

  const handleCreateLabel = async () => {
    const trimmed = newLabelName.trim();
    if (!trimmed) {
      toast.error('Ange ett etikett-namn');
      return;
    }
    try {
      const res = await fetch('/api/mail/labels/definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, color: newLabelColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create label');
      setLabelDefinitions(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewLabelName('');
      const usedColors = new Set(labelDefinitions.map(label => getLabelColorOption(label.color).hex.toUpperCase()));
      setNewLabelColor(getNextAvailableColor(usedColors));
      toast.success('Etikett skapad');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunde inte skapa etikett';
      toast.error('Kunde inte skapa etikett: ' + message);
    }
  };

  const handleUpdateLabel = async (id: string) => {
    const edits = labelEdits[id];
    const original = labelDefinitions.find(label => label.id === id);
    if (!edits || !original) return;
    const trimmed = edits.name.trim();
    if (!trimmed) {
      toast.error('Etikett-namn kan inte vara tomt');
      return;
    }
    try {
      const res = await fetch('/api/mail/labels/definitions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: trimmed, color: edits.color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update label');
      setLabelDefinitions(prev => prev.map(label => label.id === id ? data : label).sort((a, b) => a.name.localeCompare(b.name)));
      applyLabelRename(original.name, trimmed);
      toast.success('Etikett uppdaterad');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunde inte uppdatera etikett';
      toast.error('Kunde inte uppdatera etikett: ' + message);
    }
  };

  const handleDeleteLabel = async (id: string) => {
    const existing = labelDefinitions.find(label => label.id === id);
    if (!existing) return;
    if (!window.confirm(`Ta bort etiketten \"${existing.name}\"?`)) return;
    try {
      const res = await fetch('/api/mail/labels/definitions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete label');
      setLabelDefinitions(prev => prev.filter(label => label.id !== id));
      applyLabelRemoval(existing.name);
      toast.success('Etikett borttagen');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunde inte ta bort etikett';
      toast.error('Kunde inte ta bort etikett: ' + message);
    }
  };

  const handleSidebarSelect = (accountId: string, folder: string) => {
    setActiveAccountId(accountId);
    setActiveFolder(folder);
    fetchEmails(accountId, folder);
    setSelectedEmail(null);
    // Clear selected emails when changing folders
    setSelectedEmails([]);
  };

  const isTrashFolder = (folder: string) => {
    const normalized = folder.trim().toLowerCase();
    if (normalized === 'trash' || normalized === 'papperskorg') return true;
    const parts = normalized.split(/[/.]/).filter(Boolean);
    return parts.includes('trash') || parts.includes('papperskorg');
  };

  const handleEmailSelectToggle = (uid: number) => {
    setSelectedEmails(prev =>
      prev.includes(uid)
        ? prev.filter(id => id !== uid)
        : [...prev, uid]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === emails.length) {
      // Deselect all
      setSelectedEmails([]);
    } else {
      // Select all visible emails
      setSelectedEmails(emails.map(email => email.uid));
    }
  };

  const deleteSelectedEmails = async (confirmMessage?: string) => {
    if (selectedEmails.length === 0 || !activeAccountId) return;
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    try {
      const res = await fetch('/api/mail/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          uids: selectedEmails,
          folder: activeFolder
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete emails');

      // Remove deleted emails from the UI
      setEmails(prev => prev.filter(email => !selectedEmails.includes(email.uid)));
      // Clear cache for this folder to ensure fresh data on next load
      const cacheKey = `${activeAccountId}-${activeFolder}-list`;
      setEmailCache(prev => {
        const newCache = {...prev};
        delete newCache[cacheKey];
        return newCache;
      });
      setSelectedEmails([]); // Clear selection
      toast.success(`Deleted ${result.deletedCount} email(s)`);
      fetchStorageUsage();
    } catch (error: unknown) {
      console.error('Delete error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete emails';
      toast.error('Failed to delete emails: ' + message);
    }
  };

  const handleDeleteSelected = async () => {
    await deleteSelectedEmails(`Are you sure you want to delete ${selectedEmails.length} email(s)?`);
  };

  const handlePermanentDeleteSelected = async () => {
    if (!isTrashFolder(activeFolder)) return;
    await deleteSelectedEmails('Radera valda mejl permanent?');
  };

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState('');

  const handleEditSignature = (accountId: string, currentSignature: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    setCurrentSignatureAccount({
      id: accountId,
      signature: currentSignature,
      senderName: account?.senderName || '',
    });
    setShowSignatureModal(true);
  };

  const handleSaveSignature = async (signature: string, senderName: string) => {
    if (!currentSignatureAccount) return;

    try {
      const res = await fetch('/api/accounts/signature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentSignatureAccount.id,
          signature,
          senderName
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save signature');

      // Update the accounts state with the new signature
      setAccounts(prev => prev.map(account =>
        account.id === currentSignatureAccount.id
          ? { ...account, signature, senderName }
          : account
      ));

      toast.success('Signatur sparad!');
    } catch (error: unknown) {
      console.error('Save signature error:', error);
      const message = error instanceof Error ? error.message : 'Kunde inte spara signaturen';
      toast.error('Kunde inte spara signaturen: ' + message);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete account');

      const updatedAccounts = accounts.filter(account => account.id !== accountId);
      setAccounts(updatedAccounts);
      setAccountsCache(prev => (prev ? { data: updatedAccounts, timestamp: Date.now() } : null));
      setEmailCache(prev => {
        const newCache = { ...prev };
        Object.keys(newCache).forEach((key) => {
          if (key.startsWith(`${accountId}-`)) {
            delete newCache[key];
          }
        });
        return newCache;
      });

      if (activeAccountId === accountId) {
        const nextAccount = updatedAccounts[0];
        setActiveAccountId(nextAccount ? nextAccount.id : null);
        setActiveFolder('INBOX');
        setEmails([]);
        setSelectedEmail(null);
        setSelectedEmails([]);
        if (nextAccount) {
          await fetchEmails(nextAccount.id, 'INBOX');
        }
      }

      toast.success('Kontot borttaget');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kunde inte ta bort kontot';
      toast.error('Kunde inte ta bort kontot: ' + message);
    }
  };

  const handleMoveSelected = async () => {
    if (selectedEmails.length === 0 || !activeAccountId) return;

    // Fetch available folders
    try {
      const res = await fetch(`/api/mail/folders?accountId=${activeAccountId}`);
      const folders = await res.json();
      if (res.ok) {
        setAvailableFolders(folders);
        setShowMoveModal(true);
      } else {
        throw new Error(folders.error || 'Failed to fetch folders');
      }
    } catch (error: unknown) {
      console.error('Fetch folders error:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch folders';
      toast.error('Failed to fetch folders: ' + message);
    }
  };

  const handleDeleteEmail = async (uid: number) => {
    if (!activeAccountId) return;

    try {
      const res = await fetch('/api/mail/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          uids: [uid], // Send as array with single UID
          folder: activeFolder
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete email');

      // Remove deleted email from the UI
      setEmails(prev => prev.filter(email => email.uid !== uid));
      setSelectedEmail(null); // Deselect the email
      toast.success('Email deleted');
      fetchStorageUsage();
    } catch (error: unknown) {
      console.error('Delete error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete email';
      toast.error('Failed to delete email: ' + message);
    }
  };

  const handlePermanentDeleteEmail = async (uid: number) => {
    if (!activeAccountId || !isTrashFolder(activeFolder)) return;
    if (!window.confirm('Radera mejlet permanent?')) {
      return;
    }
    await handleDeleteEmail(uid);
  };

  const handleEmptyTrash = async () => {
    if (!activeAccountId || !isTrashFolder(activeFolder)) return;
    if (!window.confirm('Töm papperskorgen permanent?')) {
      return;
    }

    try {
      const res = await fetch('/api/mail/empty-trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: activeAccountId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to empty trash');

      setEmails([]);
      setSelectedEmail(null);
      setSelectedEmails([]);
      const cacheKey = `${activeAccountId}-${activeFolder}-list`;
      setEmailCache(prev => {
        const newCache = { ...prev };
        delete newCache[cacheKey];
        return newCache;
      });
      toast.success(`Tömde papperskorgen (${result.deletedCount} email)`);
      fetchStorageUsage();
    } catch (error: unknown) {
      console.error('Empty trash error:', error);
      const message = error instanceof Error ? error.message : 'Misslyckades att tömma papperskorgen';
      toast.error('Misslyckades att tömma papperskorgen: ' + message);
    }
  };

  // Helper function to extract email address from "Name <email@domain.com>" format
  const extractEmail = (fromField: string): string => {
    const emailRegex = /<([^>]+)>/;
    const match = fromField.match(emailRegex);
    return match ? match[1] : fromField; // Return the email part if found, otherwise return the whole string
  };

  const handleMoveEmail = async (uid: number, targetFolder: string) => {
    if (!activeAccountId) return;

    try {
      const res = await fetch('/api/mail/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          uids: [uid], // Send as array with single UID
          sourceFolder: activeFolder,
          targetFolder: targetFolder
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to move email');

      // Remove moved email from the current view
      setEmails(prev => prev.filter(email => email.uid !== uid));
      setSelectedEmail(null); // Deselect the email
      toast.success(result.message);
    } catch (error: unknown) {
      console.error('Move error:', error);
      const message = error instanceof Error ? error.message : 'Failed to move email';
      toast.error('Failed to move email: ' + message);
    }
  };

  const handleMoveToFolder = async (folderName: string) => {
    if (!folderName || selectedEmails.length === 0 || !activeAccountId) return;

    try {
      const res = await fetch('/api/mail/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          uids: selectedEmails,
          sourceFolder: activeFolder,
          targetFolder: folderName
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to move emails');

      // Remove moved emails from the current view
      setEmails(prev => prev.filter(email => !selectedEmails.includes(email.uid)));
      // Clear cache for this folder to ensure fresh data on next load
      const cacheKey = `${activeAccountId}-${activeFolder}-list`;
      setEmailCache(prev => {
        const newCache = {...prev};
        delete newCache[cacheKey];
        return newCache;
      });
      setSelectedEmails([]); // Clear selection
      setShowMoveModal(false);
      toast.success(result.message);
    } catch (error: unknown) {
      console.error('Move error:', error);
      const message = error instanceof Error ? error.message : 'Failed to move emails';
      toast.error('Failed to move emails: ' + message);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName || !activeAccountId) return;

    // If the folder name doesn't contain a delimiter, assume it's a subfolder of INBOX
    let formattedFolderName = newFolderName;
    if (!newFolderName.includes('.') && !newFolderName.toUpperCase().startsWith('INBOX')) {
      formattedFolderName = `INBOX.${newFolderName}`;
    }

    try {
      const res = await fetch('/api/mail/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          folderName: formattedFolderName
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create folder');

      // Refresh the folder list
      const foldersRes = await fetch(`/api/mail/folders?accountId=${activeAccountId}`);
      const folders = await foldersRes.json();
      if (foldersRes.ok) {
        setAvailableFolders(folders);
        setNewFolderName(''); // Clear the input
        toast.success(`Folder "${formattedFolderName}" created successfully`);
      } else {
        throw new Error(folders.error || 'Failed to fetch updated folders');
      }
    } catch (error: unknown) {
      console.error('Create folder error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create folder';
      toast.error('Failed to create folder: ' + message);
    }
  };

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        setAuthStatus('unauthenticated');
        setCurrentUser(null);
        return;
      }
      const data = await res.json();
      setCurrentUser(data);
      setAuthStatus('authenticated');
    } catch {
      setAuthStatus('unauthenticated');
      setCurrentUser(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthStatus('unauthenticated');
    setCurrentUser(null);
    setAccounts([]);
    setActiveAccountId(null);
    setActiveFolder('INBOX');
    setEmails([]);
    setSelectedEmail(null);
    setLabelDefinitions([]);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const nextEdits: Record<string, { name: string; color: string }> = {};
    labelDefinitions.forEach(label => {
      const normalized = getLabelColorOption(label.color);
      nextEdits[label.id] = { name: label.name, color: normalized.hex };
    });
    setLabelEdits(nextEdits);
  }, [labelDefinitions]);

  useEffect(() => {
    const used = new Set(labelDefinitions.map(label => getLabelColorOption(label.color).hex.toUpperCase()));
    if (used.has(newLabelColor.toUpperCase())) {
      setNewLabelColor(getNextAvailableColor(used));
    }
  }, [labelDefinitions, newLabelColor]);


  // Start fetching accounts and emails as soon as the component mounts
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const initializeApp = async () => {
      // Fetch accounts first
      await fetchAccounts();
      await fetchStorageUsage();
      await fetchLabelDefinitions();
    };

    initializeApp();
  }, [authStatus, fetchAccounts]);

  // Polling function to check for new emails every minute
  useEffect(() => {
    if (!activeAccountId) return; // Only poll if we have an active account

    const pollForNewEmails = async () => {
      if (!activeAccountId) return;

      try {
        // Fetch the current emails for the active folder
        const res = await fetch(`/api/mail?accountId=${activeAccountId}&folder=${encodeURIComponent(activeFolder)}&view=list`);
        const newEmails = await res.json();

        if (newEmails.error) {
          console.error('Error fetching emails for polling:', newEmails.error);
          return;
        }

        // Compare with current emails to see if there are new ones
        // Create a map of current email UIDs for quick lookup
        const currentEmailUids = new Set(emails.map(email => email.uid));

        // Find new emails by checking which ones aren't in the current list
        const newEmailsOnly = newEmails.filter((email: EmailHeader) => !currentEmailUids.has(email.uid));

        if (newEmailsOnly.length > 0) {
          // There are new emails, update the state
          setEmails(newEmails);

          // Show a notification about new emails
          toast(`${newEmailsOnly.length} new email(s) received`, {
            icon: '✉️',
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    const pollInterval: NodeJS.Timeout = setInterval(pollForNewEmails, 60000);

    // Clean up interval on component unmount or when activeAccountId changes
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [activeAccountId, activeFolder, emails]);

  useEffect(() => {
    const handleSent = (event: Event) => {
      const detail = (event as CustomEvent).detail as { accountId?: string; folder?: string } | undefined;
      if (!detail?.accountId || !detail?.folder) return;

      const cacheKey = `${detail.accountId}-${detail.folder}-list`;
      setEmailCache(prev => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });

      if (detail.accountId === activeAccountId && detail.folder === activeFolder) {
        fetchEmails(detail.accountId, detail.folder);
      }
    };

    window.addEventListener('ambmail:sent', handleSent as EventListener);
    return () => {
      window.removeEventListener('ambmail:sent', handleSent as EventListener);
    };
  }, [activeAccountId, activeFolder, fetchEmails]);

  useEffect(() => {
    if (activeAccountId) {
      // If folder changes or account changes, we usually fetch.
      // But handleSidebarSelect does it explicitly.
      // This effect runs on initial load if we set activeAccountId.
      // We can rely on handleSidebarSelect for user interactions,
      // but for initial load we need to fetch INBOX.
      if (emails.length === 0 && !isLoadingList) {
          fetchEmails(activeAccountId, activeFolder);
      }
    }
  }, [activeAccountId, activeFolder, emails.length, fetchEmails, isLoadingList]);

  if (authStatus === 'loading') {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Loading...</div>
      </main>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-10">
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/ambmail_full_logo.png"
              alt="Ambmail"
              width={120}
              height={120}
              priority
            />
            <h1 className="text-2xl font-bold mt-4">Logga in via Nextcloud</h1>
            <p className="text-gray-500 text-sm">Du måste vara inloggad i Nextcloud för att använda Ambmail</p>
          </div>
          <a
            href="/api/nextcloud/auth/start"
            className="block w-full py-3 bg-blue-600 text-white text-center font-bold rounded-2xl hover:bg-blue-700 transition-all"
          >
            Fortsätt med Nextcloud
          </a>
          <p className="mt-5 text-xs text-gray-500">
            OAuth2-inställningar hanteras i adminpanelen.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-full overflow-hidden bg-white relative">
      <Sidebar
        accounts={accounts}
        activeAccountId={activeAccountId}
        activeFolder={activeFolder}
        onSelect={handleSidebarSelect}
        onAddAccount={() => setShowAddModal(true)}
        onSettings={() => setShowManageAccounts(true)}
        onEditSignature={handleEditSignature}
        onOpenCalendar={() => setShowCalendar(true)}
        onLogout={handleLogout}
        currentUserName={currentUser?.name || currentUser?.email || currentUser?.username}
        storageUsage={storageUsage || undefined}
      />

      {accounts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
          <div className="text-center p-12 bg-white rounded-3xl shadow-sm border border-gray-100 max-w-sm flex flex-col items-center">
            <div className="mb-6">
              <Image
                src="/ambmail_full_logo.png"
                alt="Ambmail"
                width={120}
                height={120}
                priority
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">Ambmail</h1>
            <p className="text-gray-500 mb-10">Modern multi-account email client for the professional user.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              Connect Account
            </button>
          </div>
        </div>
      ) : (
        <>
          <MailList
            emails={visibleEmails}
            selectedEmailUid={selectedEmail?.uid ?? null}
            onEmailSelect={(uid) => fetchEmailBody(activeAccountId!, uid)}
            onToggleRead={handleToggleRead}
            onToggleStar={handleToggleStar}
            onToggleLabel={handleToggleLabel}
            onOpenLabelManager={() => setShowLabelManager(true)}
            showStarredOnly={showStarredOnly}
            onToggleStarFilter={() => setShowStarredOnly(prev => !prev)}
            activeLabelFilter={activeLabelFilter}
            onSelectLabelFilter={setActiveLabelFilter}
            isLoading={isLoadingList}
            onRefresh={() => {
              // Force sync with IMAP to get latest emails immediately
              fetchEmails(activeAccountId!, activeFolder, true);
            }}
            folderName={activeFolder}
            selectedEmails={selectedEmails}
            onEmailSelectToggle={handleEmailSelectToggle}
            onSelectAll={handleSelectAll}
            onDeleteSelected={handleDeleteSelected}
            onMoveSelected={handleMoveSelected}
            onEmptyTrash={handleEmptyTrash}
            showEmptyTrash={isTrashFolder(activeFolder)}
            onDeleteEmail={handleDeleteEmail}
            onPermanentDeleteEmail={handlePermanentDeleteEmail}
            onPermanentDeleteSelected={handlePermanentDeleteSelected}
            allowPermanentDelete={isTrashFolder(activeFolder)}
            labelOptions={labelOptions}
          />
          <div className="flex-1 flex flex-col relative">
            <MailView
              email={selectedEmail}
              isLoading={isLoadingBody}
              onMarkUnread={(email: EmailHeader) => {
                handleToggleRead(email.uid, true);
              }}
              onReply={async (email: EmailHeader) => {
                // Determine which signature to use based on recipient's domain
                let signature = '';
                if (activeAccountId) {
                  try {
                    const res = await fetch(`/api/accounts/signature?accountId=${activeAccountId}`);
                    const data = await res.json();
                    if (res.ok) {
                      // Get the user's email domain
                      const currentUserAccount = accounts.find(acc => acc.id === activeAccountId);
                      const userDomain = currentUserAccount?.email.split('@')[1]?.toLowerCase();

                      // Extract recipient's domain
                      const recipientEmail = extractEmail(email.from);
                      const recipientDomain = recipientEmail.split('@')[1]?.toLowerCase();

                      // Use internal signature if domains match, otherwise use external signature
                      if (userDomain && recipientDomain && userDomain === recipientDomain) {
                        signature = data.internalSignature || data.signature || '';
                      } else {
                        signature = data.externalSignature || data.signature || '';
                      }
                    }
                  } catch (error) {
                    console.error('Failed to fetch signature:', error);
                  }
                }

                // Place the cursor above the signature and quoted text
                const emailDate = email.date ? new Date(email.date).toLocaleString() : 'unknown date';
                const bodyWithSignature = signature
                  ? `<p></p>${signature}<br /><br /><div class="email-reply"><br /><br />On ${emailDate}, ${email.from} wrote:<br />${email.body}</div>`
                  : `<p></p><div class="email-reply"><br /><br />On ${emailDate}, ${email.from} wrote:<br />${email.body}</div>`;

                const newComposeData = {
                  to: extractEmail(email.from), // Extract just the email address from "Name <email@domain.com>" format
                  subject: `Re: ${email.subject}`.replace(/^Re:\s*/, ''), // Remove existing Re: prefix
                  body: bodyWithSignature,
                  uid: undefined // New message, no UID yet
                };

                // Add a new compose window to the array
                const newWindow = {
                  id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: activeAccountId!,
                  initialData: newComposeData,
                  minimized: false
                };

                setComposeWindows(prev => [...prev, newWindow]);
              }}
              onReplyAll={async (email: EmailHeader) => {
                // For reply all, include the sender and all recipients (to and cc)
                const recipients = [extractEmail(email.from)]; // Always include sender
                if (email.to) {
                  // Split multiple recipients and extract emails
                  const toRecipients = email.to.split(',').map((r: string) => extractEmail(r.trim()));
                  recipients.push(...toRecipients);
                }
                if (email.cc) {
                  // Split multiple CC recipients and extract emails
                  const ccRecipients = email.cc.split(',').map((r: string) => extractEmail(r.trim()));
                  recipients.push(...ccRecipients);
                }

                // Remove duplicates and empty strings
                const uniqueRecipients = [...new Set(recipients.filter(recipient => recipient !== ''))];

                // Determine which signature to use based on recipient's domain
                let signature = '';
                if (activeAccountId) {
                  try {
                    const res = await fetch(`/api/accounts/signature?accountId=${activeAccountId}`);
                    const data = await res.json();
                    if (res.ok) {
                      // Get the user's email domain
                      const currentUserAccount = accounts.find(acc => acc.id === activeAccountId);
                      const userDomain = currentUserAccount?.email.split('@')[1]?.toLowerCase();

                      // Extract recipient's domain
                      const recipientEmail = extractEmail(email.from);
                      const recipientDomain = recipientEmail.split('@')[1]?.toLowerCase();

                      // Use internal signature if domains match, otherwise use external signature
                      if (userDomain && recipientDomain && userDomain === recipientDomain) {
                        signature = data.internalSignature || data.signature || '';
                      } else {
                        signature = data.externalSignature || data.signature || '';
                      }
                    }
                  } catch (error) {
                    console.error('Failed to fetch signature:', error);
                  }
                }

                // Place the cursor above the signature and quoted text
                const emailDate = email.date ? new Date(email.date).toLocaleString() : 'unknown date';
                const bodyWithSignature = signature
                  ? `<p></p>${signature}<br /><br /><div class="email-reply"><br /><br />On ${emailDate}, ${email.from} wrote:<br />${email.body}</div>`
                  : `<p></p><div class="email-reply"><br /><br />On ${emailDate}, ${email.from} wrote:<br />${email.body}</div>`;

                const newComposeData = {
                  to: uniqueRecipients.join(', '),
                  subject: `Re: ${email.subject}`.replace(/^Re:\s*/, ''),
                  body: bodyWithSignature,
                  uid: undefined
                };

                // Add a new compose window to the array
                const newWindow = {
                  id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: activeAccountId!,
                  initialData: newComposeData,
                  minimized: false
                };

                setComposeWindows(prev => [...prev, newWindow]);
              }}
              onForward={async (email: EmailHeader) => {
                // Determine which signature to use based on recipient's domain
                let signature = '';
                if (activeAccountId) {
                  try {
                    const res = await fetch(`/api/accounts/signature?accountId=${activeAccountId}`);
                    const data = await res.json();
                    if (res.ok) {
                      // Get the user's email domain
                      const currentUserAccount = accounts.find(acc => acc.id === activeAccountId);
                      const userDomain = currentUserAccount?.email.split('@')[1]?.toLowerCase();

                      // Extract recipient's domain
                      const recipientEmail = extractEmail(email.from);
                      const recipientDomain = recipientEmail.split('@')[1]?.toLowerCase();

                      // Use internal signature if domains match, otherwise use external signature
                      if (userDomain && recipientDomain && userDomain === recipientDomain) {
                        signature = data.internalSignature || data.signature || '';
                      } else {
                        signature = data.externalSignature || data.signature || '';
                      }
                    }
                  } catch (error) {
                    console.error('Failed to fetch signature:', error);
                  }
                }

                // Place the cursor above the signature and forwarded content
                const emailDate = email.date ? new Date(email.date).toLocaleString() : 'unknown date';
                const bodyWithSignature = signature
                  ? `<p></p>${signature}<br /><br /><div class="email-forward"><br /><br />---------- Forwarded message ----------<br />From: ${email.from}<br />Date: ${emailDate}<br />Subject: ${email.subject}<br />${email.body || ''}</div>`
                  : `<p></p><div class="email-forward"><br /><br />---------- Forwarded message ----------<br />From: ${email.from}<br />Date: ${emailDate}<br />Subject: ${email.subject}<br />${email.body || ''}</div>`;

                const newComposeData = {
                  to: '',
                  subject: `Fwd: ${email.subject}`,
                  body: bodyWithSignature,
                  uid: undefined
                };

                // Add a new compose window to the array
                const newWindow = {
                  id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: activeAccountId!,
                  initialData: newComposeData,
                  minimized: false
                };

                setComposeWindows(prev => [...prev, newWindow]);
              }}
              onDelete={(email: EmailHeader) => {
                if (selectedEmail && window.confirm('Are you sure you want to delete this email?')) {
                  handleDeleteEmail(email.uid);
                }
              }}
              onMoveToFolder={(email: EmailHeader) => {
                // For now, we'll implement a simple version where the user enters the folder name
                const folderName = prompt('Enter target folder name:');
                if (folderName && activeAccountId) {
                  handleMoveEmail(email.uid, folderName);
                }
              }}
              onComposeTo={async (address: string) => {
                // For new emails, use the external signature by default
                let signature = '';
                if (activeAccountId) {
                  try {
                    const res = await fetch(`/api/accounts/signature?accountId=${activeAccountId}`);
                    const data = await res.json();
                    if (res.ok) {
                      // Use external signature for new emails by default
                      signature = data.externalSignature || data.signature || '';
                    }
                  } catch (error) {
                    console.error('Failed to fetch signature:', error);
                  }
                }

                // Set initial data with signature and recipient
                const newComposeData = {
                  to: address,
                  subject: '',
                  body: signature ? `<p></p>${signature}` : '',
                  uid: undefined
                };

                // Add a new compose window to the array
                const newWindow = {
                  id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: activeAccountId!,
                  initialData: newComposeData,
                  minimized: false
                };

                setComposeWindows(prev => [...prev, newWindow]);
              }}
            />
            
            <button
              onClick={async () => {
                // For new emails, use the external signature by default
                let signature = '';
                if (activeAccountId) {
                  try {
                    const res = await fetch(`/api/accounts/signature?accountId=${activeAccountId}`);
                    const data = await res.json();
                    if (res.ok) {
                      // Use external signature for new emails by default
                      signature = data.externalSignature || data.signature || '';
                    }
                  } catch (error) {
                    console.error('Failed to fetch signature:', error);
                  }
                }

                // Set initial data with signature if available
                const newComposeData = {
                  to: '',
                  subject: '',
                  body: signature ? `<p></p>${signature}` : '',
                  uid: undefined
                };

                // Add a new compose window to the array
                const newWindow = {
                  id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: activeAccountId!,
                  initialData: newComposeData,
                  minimized: false
                };

                setComposeWindows(prev => [...prev, newWindow]);
              }}
              className="absolute bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 z-40"
              title="Skapa nytt mejl"
            >
              <PenSquare size={26} />
            </button>
          </div>
        </>
      )}

      {composeWindows.map((window) => (
        <Suspense key={window.id} fallback={null}>
          <ComposeEmail
            windowId={window.id}
            accountId={window.accountId}
            onClose={(windowId) => {
              setComposeWindows(prev => prev.filter(w => w.id !== windowId));
            }}
            onMinimize={(windowId) => {
              setComposeWindows(prev =>
                prev.map(w =>
                  w.id === windowId ? { ...w, minimized: true } : w
                )
              );
            }}
            onRestore={(windowId) => {
              setComposeWindows(prev =>
                prev.map(w =>
                  w.id === windowId ? { ...w, minimized: false } : w
                )
              );
            }}
            initialData={window.initialData}
          />
        </Suspense>
      ))}

      {showAddModal && (
        <Suspense fallback={null}>
          <AddAccountModal
            onClose={() => setShowAddModal(false)}
            onSuccess={async () => {
              setShowAddModal(false);
              const updatedAccounts = await fetchAccounts(true); // Force refresh to get the new account

              // If this is the first account being added, set it as active and fetch its emails
              if (updatedAccounts && updatedAccounts.length > 0) {
                const newAccount = updatedAccounts[updatedAccounts.length - 1]; // Get the most recently added account
                setActiveAccountId(newAccount.id);

                // Fetch emails for the new account's INBOX
                await fetchEmails(newAccount.id, 'INBOX');

              }
            }}
          />
        </Suspense>
      )}

      {/* Move Email Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Move Selected Emails</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Target Folder</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                onChange={(e) => handleMoveToFolder(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Select a folder</option>
                {availableFolders
                  .filter(folder => folder !== activeFolder) // Don't show current folder as option
                  .map((folder, index) => (
                    <option key={index} value={folder}>{folder}</option>
                  ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Or Create New Folder</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="flex-1 p-2 border border-gray-300 rounded-md"
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <button
                    onClick={handleCreateFolder}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Note: Use dots (.) to create subfolders, e.g., &quot;INBOX.Archive&quot; or just &quot;Archive&quot; to create &quot;INBOX.Archive&quot;
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLabelManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Etiketter</h3>
              <button
                onClick={() => setShowLabelManager(false)}
                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-800"
              >
                Stang
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {labelDefinitions.length === 0 && (
                <div className="text-sm text-gray-500">Inga etiketter skapade.</div>
              )}
              {labelDefinitions.map(label => {
                const edits = labelEdits[label.id] || { name: label.name, color: label.color };
                return (
                  <div key={label.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={edits.name}
                        onChange={(event) => {
                          const value = event.target.value;
                          setLabelEdits(prev => ({ ...prev, [label.id]: { ...edits, name: value } }));
                        }}
                        className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
                        placeholder="Etikett"
                      />
                      <button
                        onClick={() => handleUpdateLabel(label.id)}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Spara
                      </button>
                      <button
                        onClick={() => handleDeleteLabel(label.id)}
                        className="px-2 py-2 text-xs text-red-600 hover:text-red-800"
                      >
                        Radera
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={edits.color}
                        onChange={(event) => {
                          const value = event.target.value.toUpperCase();
                          setLabelEdits(prev => ({ ...prev, [label.id]: { ...edits, color: value } }));
                        }}
                        className="h-8 w-8 rounded border border-gray-200"
                        title="Valj färg"
                      />
                      <span className="text-xs text-gray-500">{edits.color}</span>
                    </div>
                  </div>
                );
              })}
            </div>

              <div className="mt-6 border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Skapa ny etikett</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={newLabelName}
                    onChange={(event) => setNewLabelName(event.target.value)}
                    className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
                    placeholder="Namn"
                  />
                  <button
                    onClick={handleCreateLabel}
                    className="px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-black"
                  >
                    Skapa
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={(event) => setNewLabelColor(event.target.value.toUpperCase())}
                    className="h-8 w-8 rounded border border-gray-200"
                    title="Valj färg"
                  />
                  <span className="text-xs text-gray-500">{newLabelColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && currentSignatureAccount && (
        <Suspense fallback={null}>
          <SignatureModal
            isOpen={showSignatureModal}
            onClose={() => setShowSignatureModal(false)}
            onSave={handleSaveSignature}
            initialSignature={currentSignatureAccount.signature}
            initialSenderName={currentSignatureAccount.senderName}
          />
        </Suspense>
      )}

      {showManageAccounts && (
        <Suspense fallback={null}>
          <ManageAccountsModal
            accounts={accounts}
            onClose={() => setShowManageAccounts(false)}
            onAdd={() => {
              setShowManageAccounts(false);
              setShowAddModal(true);
            }}
            onDelete={handleDeleteAccount}
          />
        </Suspense>
      )}

      {showCalendar && (
        <Suspense fallback={null}>
          <CalendarModal onClose={() => setShowCalendar(false)} />
        </Suspense>
      )}
    </main>
  );
}
