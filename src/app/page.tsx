'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar, { Account } from '@/components/Sidebar';
import MailList, { EmailHeader } from '@/components/MailList';
import MailView from '@/components/MailView';

// Lazy load modal and compose components for better initial load performance
const AddAccountModal = lazy(() => import('@/components/AddAccountModal'));
const ComposeEmail = lazy(() => import('@/components/ComposeEmail'));
const SignatureModal = lazy(() => import('@/components/SignatureModal'));
const ManageAccountsModal = lazy(() => import('@/components/ManageAccountsModal'));
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>('INBOX');
  const [viewMode, setViewMode] = useState<'list'>('list');
  const [emails, setEmails] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingBody, setIsLoadingBody] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageAccounts, setShowManageAccounts] = useState(false);
  const [composeWindows, setComposeWindows] = useState<Array<{
    id: string;
    accountId: string;
    initialData?: any;
    minimized: boolean;
  }>>([]);
  const [composeInitialData, setComposeInitialData] = useState<any>(null);
  // Multi-select state
  const [selectedEmails, setSelectedEmails] = useState<number[]>([]);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; quotaMb: number | null } | null>(null);

  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [currentSignatureAccount, setCurrentSignatureAccount] = useState<{id: string, signature: string} | null>(null);

  // Cache for accounts to avoid unnecessary API calls
  const [accountsCache, setAccountsCache] = useState<{data: Account[], timestamp: number} | null>(null);
  const ACCOUNTS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Cache for email lists to avoid unnecessary API calls
  const [emailCache, setEmailCache] = useState<Record<string, {data: any[], timestamp: number}>>({});
  const EMAIL_LIST_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  const fetchAccounts = async (forceRefresh = false) => {
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
  };

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

  const fetchEmails = async (accountId: string, folder: string) => {
    const cacheKey = `${accountId}-${folder}-list`; // Fixed to 'list' mode only

    // Check if we have cached data that's still valid (including pre-fetched data)
    if (emailCache[cacheKey] && (Date.now() - emailCache[cacheKey].timestamp) < EMAIL_LIST_CACHE_DURATION) {
      setEmails(emailCache[cacheKey].data);
      setIsLoadingList(false);
      return;
    }

    setIsLoadingList(true);
    try {
      // Use encodeURIComponent for folders like "Inbox.Sent" etc if needed
      const res = await fetch(`/api/mail?accountId=${accountId}&folder=${encodeURIComponent(folder)}&view=list`);
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
    } catch (error: any) {
      toast.error('Failed to fetch emails: ' + error.message);
      setEmails([]);
    } finally {
      setIsLoadingList(false);
    }
  };


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
        // Update the initial data for the compose window
        setComposeInitialData({
          to: data.to || '',
          subject: data.subject,
          body: data.body,
          uid: data.uid
        });

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
    } catch (error: any) {
      // If it's a "Message not found" error, try to refresh the email list
      if (error.message.includes('Message not found')) {
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
        toast.error('Failed to fetch email body: ' + error.message);
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
    } catch (error: any) {
      toast.error('Kunde inte uppdatera status: ' + error.message);
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
    return normalized === 'trash' || normalized === 'papperskorg';
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

  const handleDeleteSelected = async () => {
    if (selectedEmails.length === 0 || !activeAccountId) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedEmails.length} email(s)?`)) {
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
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete emails: ' + error.message);
    }
  };

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState('');

  const handleEditSignature = (accountId: string, currentSignature: string) => {
    setCurrentSignatureAccount({ id: accountId, signature: currentSignature });
    setShowSignatureModal(true);
  };

  const handleSaveSignature = async (signature: string) => {
    if (!currentSignatureAccount) return;

    try {
      const res = await fetch('/api/accounts/signature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentSignatureAccount.id,
          signature
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save signature');

      // Update the accounts state with the new signature
      setAccounts(prev => prev.map(account =>
        account.id === currentSignatureAccount.id
          ? { ...account, signature }
          : account
      ));

      toast.success('Signatur sparad!');
    } catch (error: any) {
      console.error('Save signature error:', error);
      toast.error('Kunde inte spara signaturen: ' + error.message);
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
    } catch (error: any) {
      toast.error('Kunde inte ta bort kontot: ' + error.message);
    }
  };

  const handleMoveSelected = async (targetFolder: string) => {
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
    } catch (error: any) {
      console.error('Fetch folders error:', error);
      toast.error('Failed to fetch folders: ' + error.message);
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
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete email: ' + error.message);
    }
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
    } catch (error: any) {
      console.error('Empty trash error:', error);
      toast.error('Misslyckades att tömma papperskorgen: ' + error.message);
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
    } catch (error: any) {
      console.error('Move error:', error);
      toast.error('Failed to move email: ' + error.message);
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
    } catch (error: any) {
      console.error('Move error:', error);
      toast.error('Failed to move emails: ' + error.message);
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
    } catch (error: any) {
      console.error('Create folder error:', error);
      toast.error('Failed to create folder: ' + error.message);
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

  const handleLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      if (!res.ok) {
        const err = await res.json();
        setLoginError(err.error || 'Inloggning misslyckades');
        return;
      }
      const data = await res.json();
      setCurrentUser(data);
      setAuthStatus('authenticated');
      await fetchAccounts(true);
    } catch (error: any) {
      setLoginError('Inloggning misslyckades');
    } finally {
      setIsLoggingIn(false);
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
  };

  useEffect(() => {
    checkAuth();
  }, []);


  // Start fetching accounts and emails as soon as the component mounts
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const initializeApp = async () => {
      // Fetch accounts first
      await fetchAccounts();
      await fetchStorageUsage();
    };

    initializeApp();
  }, [authStatus]);

  // Polling function to check for new emails every minute
  useEffect(() => {
    if (!activeAccountId) return; // Only poll if we have an active account

    let pollInterval: NodeJS.Timeout;

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
        const newEmailsOnly = newEmails.filter((email: any) => !currentEmailUids.has(email.uid));

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

    // Start polling every minute (60,000 ms)
    pollInterval = setInterval(pollForNewEmails, 60000);

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

    window.addEventListener('uxmail:sent', handleSent as EventListener);
    return () => {
      window.removeEventListener('uxmail:sent', handleSent as EventListener);
    };
  }, [activeAccountId, activeFolder]);

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
  }, [activeAccountId]);

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
              src="/logo.png"
              alt="UxMail"
              width={120}
              height={120}
              priority
            />
            <h1 className="text-2xl font-bold mt-4">Logga in</h1>
            <p className="text-gray-500 text-sm">Använd ditt användarnamn och lösenord</p>
          </div>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleLogin();
            }}
          >
            <input
              type="text"
              placeholder="Användarnamn"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              type="password"
              placeholder="Lösenord"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {loginError && <div className="text-sm text-red-600">{loginError}</div>}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'Loggar in...' : 'Logga in'}
            </button>
          </form>
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
        onLogout={handleLogout}
        currentUserName={currentUser?.name || currentUser?.username}
        storageUsage={storageUsage || undefined}
      />

      {accounts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
          <div className="text-center p-12 bg-white rounded-3xl shadow-sm border border-gray-100 max-w-sm flex flex-col items-center">
            <div className="mb-6">
              <Image
                src="/logo.png"
                alt="UxMail"
                width={120}
                height={120}
                priority
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">UxMail</h1>
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
            emails={emails}
            selectedEmailUid={selectedEmail?.uid}
            onEmailSelect={(uid) => fetchEmailBody(activeAccountId!, uid)}
            onToggleRead={handleToggleRead}
            isLoading={isLoadingList}
            onRefresh={() => {
              // Clear cache for this folder to ensure fresh data
              const cacheKey = `${activeAccountId}-${activeFolder}-list`;
              setEmailCache(prev => {
                const newCache = {...prev};
                delete newCache[cacheKey];
                return newCache;
              });
              fetchEmails(activeAccountId!, activeFolder);
            }}
            folderName={activeFolder}
            selectedEmails={selectedEmails}
            onEmailSelectToggle={handleEmailSelectToggle}
            onSelectAll={handleSelectAll}
            onDeleteSelected={handleDeleteSelected}
            onMoveSelected={handleMoveSelected}
            onEmptyTrash={handleEmptyTrash}
            showEmptyTrash={isTrashFolder(activeFolder)}
          />
          <div className="flex-1 flex flex-col relative">
            <MailView
              email={selectedEmail}
              isLoading={isLoadingBody}
              onReply={async (email) => {
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
                const bodyWithSignature = signature
                  ? `<p></p>${signature}<br /><br /><div class="email-reply"><br /><br />On ${new Date(email.date).toLocaleString()}, ${email.from} wrote:<br />${email.body}</div>`
                  : `<p></p><div class="email-reply"><br /><br />On ${new Date(email.date).toLocaleString()}, ${email.from} wrote:<br />${email.body}</div>`;

                const newComposeData = {
                  to: extractEmail(email.from), // Extract just the email address from "Name <email@domain.com>" format
                  subject: `Re: ${email.subject}`.replace(/^Re:\s*/, ''), // Remove existing Re: prefix
                  body: bodyWithSignature,
                  uid: undefined // New message, no UID yet
                };

                setComposeInitialData(newComposeData);

                // Add a new compose window to the array
                const newWindow = {
                  id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: activeAccountId!,
                  initialData: newComposeData,
                  minimized: false
                };

                setComposeWindows(prev => [...prev, newWindow]);
              }}
              onReplyAll={async (email) => {
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
                const bodyWithSignature = signature
                  ? `<p></p>${signature}<br /><br /><div class="email-reply"><br /><br />On ${new Date(email.date).toLocaleString()}, ${email.from} wrote:<br />${email.body}</div>`
                  : `<p></p><div class="email-reply"><br /><br />On ${new Date(email.date).toLocaleString()}, ${email.from} wrote:<br />${email.body}</div>`;

                const newComposeData = {
                  to: uniqueRecipients.join(', '),
                  subject: `Re: ${email.subject}`.replace(/^Re:\s*/, ''),
                  body: bodyWithSignature,
                  uid: undefined
                };

                setComposeInitialData(newComposeData);

                // Add a new compose window to the array
                const newWindow = {
                  id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: activeAccountId!,
                  initialData: newComposeData,
                  minimized: false
                };

                setComposeWindows(prev => [...prev, newWindow]);
              }}
              onForward={async (email) => {
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
                const bodyWithSignature = signature
                  ? `<p></p>${signature}<br /><br /><div class="email-forward"><br /><br />---------- Forwarded message ----------<br />From: ${email.from}<br />Date: ${new Date(email.date).toLocaleString()}<br />Subject: ${email.subject}<br />${email.body}</div>`
                  : `<p></p><div class="email-forward"><br /><br />---------- Forwarded message ----------<br />From: ${email.from}<br />Date: ${new Date(email.date).toLocaleString()}<br />Subject: ${email.subject}<br />${email.body}</div>`;

                const newComposeData = {
                  to: '',
                  subject: `Fwd: ${email.subject}`,
                  body: bodyWithSignature,
                  uid: undefined
                };

                setComposeInitialData(newComposeData);

                // Add a new compose window to the array
                const newWindow = {
                  id: `compose-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  accountId: activeAccountId!,
                  initialData: newComposeData,
                  minimized: false
                };

                setComposeWindows(prev => [...prev, newWindow]);
              }}
              onDelete={(email) => {
                if (selectedEmail && window.confirm('Are you sure you want to delete this email?')) {
                  handleDeleteEmail(email.uid);
                }
              }}
              onMoveToFolder={(email) => {
                // For now, we'll implement a simple version where the user enters the folder name
                const folderName = prompt('Enter target folder name:');
                if (folderName && activeAccountId) {
                  handleMoveEmail(email.uid, folderName);
                }
              }}
              onComposeTo={async (address) => {
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

                setComposeInitialData(newComposeData);

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

                setComposeInitialData(newComposeData);

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
            >
              <Plus size={28} />
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
              if (composeWindows.length <= 1) {
                setComposeInitialData(null);
              }
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
                  Note: Use dots (.) to create subfolders, e.g., "INBOX.Archive" or just "Archive" to create "INBOX.Archive"
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

      {showSignatureModal && currentSignatureAccount && (
        <Suspense fallback={null}>
          <SignatureModal
            isOpen={showSignatureModal}
            onClose={() => setShowSignatureModal(false)}
            onSave={handleSaveSignature}
            initialSignature={currentSignatureAccount.signature}
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
    </main>
  );
}
