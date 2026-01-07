'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Maximize2, Minimize2, ExternalLink, FileSignature } from 'lucide-react';
import toast from 'react-hot-toast';
import TiptapEditor from './TiptapEditor';
import EmailInput from './EmailInput';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface ComposeEmailProps {
  accountId: string;
  windowId: string;
  onClose: (windowId: string) => void;
  onMinimize: (windowId: string) => void;
  onRestore: (windowId: string) => void;
  mode?: 'modal' | 'standalone';
  initialData?: {
    to: string;
    subject: string;
    body: string;
    uid?: number; // Add uid for draft tracking
  };
}

export default function ComposeEmail({ accountId, windowId, onClose, onMinimize, onRestore, mode = 'modal', initialData }: ComposeEmailProps) {
  const [to, setTo] = useState<string[]>(() => {
    // Parse initial "to" field into an array of emails
    if (initialData?.to) {
      return initialData.to
        .split(/[,\s;]+/) // Split by comma, semicolon, or whitespace
        .map(email => email.trim())
        .filter(email => email !== '');
    }
    return [];
  });
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [body, setBody] = useState(initialData?.body || '');
  const [draftUid, setDraftUid] = useState<number | undefined>(initialData?.uid);
  const [isSwitchingDraft, setIsSwitchingDraft] = useState(false); // Flag to track draft switching
  const [isDraftLoaded, setIsDraftLoaded] = useState(false); // Flag to track if this is an existing draft

  // Signature state variables
  const [accountSignature, setAccountSignature] = useState<string | null>(null);

  // Update state when initialData changes (for switching between drafts)
  // Automatically save current draft before switching to a new one
  useEffect(() => {
    if (initialData && initialData.uid !== draftUid && !isSwitchingDraft) {
      // Set the switching flag to prevent auto-save during switch
      setIsSwitchingDraft(true);

      // Check if there's unsaved content that should be saved first
      const hasUnsavedContent = to.length > 0 || subject.trim() || body.trim();

      if (hasUnsavedContent && draftUid !== undefined) {
        // Auto-save the current draft before switching
        const saveCurrentDraft = async () => {
          // If the signature is not already in the body, add it
          let finalBody = body;
          if (accountSignature && !body.includes(accountSignature)) {
            finalBody = accountSignature + (body ? `<br /><br />${body}` : '');
          }

          try {
            const toEmails = to.join(', ');
            const res = await fetch('/api/mail/draft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountId,
                to: toEmails,
                subject,
                body: finalBody,
                uid: draftUid
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.uid && data.uid !== draftUid) {
                // Only update the draftUid if it has actually changed
                setDraftUid(data.uid);
                console.log('Draft saved successfully with new UID:', data.uid);
              } else {
                console.log('Draft saved with same UID or no UID returned');
              }
              setLastSaved(Date.now());
              // Update the ref with current content
              lastSavedContentRef.current = { to, subject, body: finalBody };
            } else {
              const errorData = await res.json();
              console.error('Failed to save draft before switching:', errorData);
            }
          } catch (e) {
            console.error('Failed to save draft before switching', e);
          }
        };

        saveCurrentDraft();

        // Now switch to the new draft after a brief delay to allow save to complete
        setTimeout(() => {
          setTo(initialData.to
            ? initialData.to
                .split(/[,\s;]+/) // Split by comma, semicolon, or whitespace
                .map(email => email.trim())
                .filter(email => email !== '')
            : []);
          setSubject(initialData.subject || '');
          setBody(initialData.body || '');
          setDraftUid(initialData.uid);
          setIsDraftLoaded(!!initialData.uid); // Set flag if we're loading an existing draft
          setLastSaved(Date.now()); // Update last saved time to prevent immediate autosave

          // Reset the switching flag after a short delay to allow state updates
          setTimeout(() => setIsSwitchingDraft(false), 100);
        }, 300); // Delay to allow the save to complete
      } else {
        // No unsaved content, safe to update
        setTo(initialData.to
          ? initialData.to
              .split(/[,\s;]+/) // Split by comma, semicolon, or whitespace
              .map(email => email.trim())
              .filter(email => email !== '')
          : []);
        setSubject(initialData.subject || '');
        setBody(initialData.body || '');
        setDraftUid(initialData.uid);
        setIsDraftLoaded(!!initialData.uid); // Set flag if we're loading an existing draft
        setLastSaved(Date.now()); // Update last saved time to prevent immediate autosave

        // Reset the switching flag after a short delay to allow state updates
        setTimeout(() => setIsSwitchingDraft(false), 100);
      }
    } else if (initialData && !initialData.uid && !isDraftLoaded) {
      // This is a new email (not a draft), so set the initial data
      setTo(initialData.to
        ? initialData.to
            .split(/[,\s;]+/) // Split by comma, semicolon, or whitespace
            .map(email => email.trim())
            .filter(email => email !== '')
        : []);
      setSubject(initialData.subject || '');
      setBody(initialData.body || '');
      setIsDraftLoaded(true); // Mark as loaded to prevent multiple insertions
    }
  }, [initialData, to, subject, body, draftUid, accountId, isSwitchingDraft, isDraftLoaded, accountSignature]);

  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<number>(Date.now() - 3000); // Initialize to 3 seconds ago to avoid initial trigger
  const [showAutoSaved, setShowAutoSaved] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isSignatureInserted, setIsSignatureInserted] = useState(false);

  // State for tracking input value separately from the email list
  const [inputValue, setInputValue] = useState<string>('');

  // Fetch account signature when component mounts
  useEffect(() => {
    const fetchSignature = async () => {
      try {
        const res = await fetch(`/api/accounts/signature?accountId=${accountId}`);
        const data = await res.json();
        if (res.ok) {
          setAccountSignature(data.signature || null);
        }
      } catch (error) {
        console.error('Failed to fetch signature:', error);
      }
    };

    fetchSignature();
  }, [accountId]);

  // Insert signature when account signature is loaded and it's a new email (not a draft) and no initial signature was provided
  useEffect(() => {
    // Only insert signature if it's not already in the initial body
    if (accountSignature && !isSignatureInserted && !initialData?.uid) {
      if (initialData?.body && initialData.body.includes(accountSignature)) {
        // Signature is already in the initial body, mark as inserted
        setIsSignatureInserted(true);
      } else if (!initialData?.body && body === accountSignature) {
        // Signature was set as the initial body for a new email, mark as inserted
        setIsSignatureInserted(true);
      } else if (body && !body.includes(accountSignature)) {
        // Signature is not in the body yet, add it at the beginning
        setBody(prevBody => accountSignature + (prevBody ? `<br /><br />${prevBody}` : ''));
        setIsSignatureInserted(true);
      }
    }
  }, [accountSignature, isSignatureInserted, initialData?.uid, body, initialData?.body]);

  // Ref to store the timeout ID for proper cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to store the timeout ID for the auto-saved indicator
  const autoSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to store the last saved content to avoid unnecessary saves
  const lastSavedContentRef = useRef({
    to: initialData?.to
      ? initialData.to
          .split(/[,\s;]+/) // Split by comma, semicolon, or whitespace
          .map(email => email.trim())
          .filter(email => email !== '')
      : [],
    subject: initialData?.subject || '',
    body: initialData?.body || ''
  });

  // Save draft when component unmounts (when closing the email)
  useEffect(() => {
    return () => {
      // Only save if there's content and it has changed since last save
      const hasContent = to.length > 0 || subject.trim() || body.trim();
      const hasContentChanged =
        JSON.stringify(lastSavedContentRef.current.to) !== JSON.stringify(to) ||
        lastSavedContentRef.current.subject !== subject ||
        lastSavedContentRef.current.body !== body;

      if (hasContent && hasContentChanged && !isSending && !isSwitchingDraft) {
        // If the signature is not already in the body, add it
        let finalBody = body;
        if (accountSignature && !body.includes(accountSignature)) {
          finalBody = accountSignature + (body ? `<br /><br />${body}` : '');
        }

        try {
          const toEmails = to.join(', ');
          const res = fetch('/api/mail/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId,
              to: toEmails,
              subject,
              body: finalBody,
              uid: draftUid
            }),
          }).then(response => response.json()).then(data => {
            if (data.uid && data.uid !== draftUid) {
              // Only update the draftUid if it has actually changed
              setDraftUid(data.uid);
              console.log('Draft saved successfully with new UID:', data.uid);
            } else {
              console.log('Draft saved with same UID or no UID returned');
            }
            setLastSaved(Date.now());
            // Update the ref with current content
            lastSavedContentRef.current = { to, subject, body: finalBody };
          }).catch(e => {
            console.error('Failed to save draft on unmount', e);
          });
        } catch (e) {
          console.error('Failed to save draft on unmount', e);
        }
      }
    };
  }, [to, subject, body, draftUid, accountId, isSending, isSwitchingDraft, accountSignature]);

  // Function to manually save draft (useful when switching between emails)
  const saveDraftNow = async () => {
    // If the signature is not already in the body, add it
    let finalBody = body;
    if (accountSignature && !body.includes(accountSignature)) {
      finalBody = accountSignature + (body ? `<br /><br />${body}` : '');
    }

    // Check if content has actually changed since last save
    const hasContentChanged =
      JSON.stringify(lastSavedContentRef.current.to) !== JSON.stringify(to) ||
      lastSavedContentRef.current.subject !== subject ||
      lastSavedContentRef.current.body !== finalBody;

    // Allow manual saving even for existing drafts
    if ((to.length > 0 || subject.trim() || finalBody.trim()) && !isSavingDraft && hasContentChanged) {
      setIsSavingDraft(true);
      try {
        const toEmails = to.join(', ');
        const res = await fetch('/api/mail/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            to: toEmails,
            subject,
            body: finalBody,
            uid: draftUid
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.uid) {
            setDraftUid(data.uid);
          }
          setLastSaved(Date.now());
          setShowAutoSaved(true);
          if (autoSavedTimeoutRef.current) {
            clearTimeout(autoSavedTimeoutRef.current);
          }
          autoSavedTimeoutRef.current = setTimeout(() => {
            setShowAutoSaved(false);
          }, 1000);
          lastSavedContentRef.current = { to, subject, body: finalBody };
        }
      } catch (e) {
        console.error('Failed to save draft', e);
      } finally {
        setIsSavingDraft(false);
      }
    } else if (!hasContentChanged) {
      console.log('Draft not saved - no changes detected');
    }
  };

  useEffect(() => {
    if (inputValue && inputValue.length > 1) {
      // Use the current input value for suggestions
      fetch(`/api/contacts?q=${inputValue}`)
        .then(res => res.json())
        .then(setSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [inputValue]);

  const handleSend = async () => {
    if (!to.length || !subject) {
      toast.error('Recipient and subject are required');
      return;
    }

    // Join the email array into a comma-separated string
    const toEmails = to.join(', ');

    // If the signature is not already in the body, add it
    let finalBody = body;
    if (accountSignature && !body.includes(accountSignature)) {
      finalBody = accountSignature + (body ? `<br /><br />${body}` : '');
    }

    console.log('Sending email with data:', { accountId, to: toEmails, subject, body: finalBody.substring(0, 100) + '...' });
    setIsSending(true);
    try {
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, to: toEmails, subject, body: finalBody }),
      });

      const result = await res.json();
      console.log('Send API response:', result);

      if (!res.ok) {
        console.error('Failed to send email:', result.error);
        throw new Error(result.error || 'Failed to send email');
      }

      toast.success('Email sent!');
      if (mode === 'standalone') {
        window.close();
      } else {
        onClose(windowId);
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handlePopout = () => {
    const draftId = Date.now().toString();
    const data = { accountId, to, subject, body };
    localStorage.setItem(`draft_${draftId}`, JSON.stringify(data));
    
    const width = 800;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    window.open(
      `/compose?draftId=${draftId}`, 
      `Compose - ${subject || 'New Message'}`, 
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
    
    onClose(windowId);
  };

  const containerClasses = mode === 'modal'
    ? cn(
        "fixed bg-white shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden transition-all duration-300 ease-in-out",
        isMinimized
          ? "w-80 h-12 bottom-0 right-8 rounded-t-lg" // Minimized state
          : isMaximized
            ? "inset-4 md:inset-10 rounded-2xl h-auto"
            : "bottom-0 right-8 w-full max-w-4xl rounded-t-2xl h-[80vh]"
      )
    : "flex flex-col h-screen w-full bg-white";

  return (
    <div className={containerClasses}>
      {isMinimized ? (
        // Minimized view
        <div
          className="h-full flex items-center justify-between px-3 py-2 bg-gray-900 text-white cursor-pointer"
          onClick={() => {
            onRestore(windowId);
            setIsMinimized(false);
          }}
        >
          <div className="flex items-center truncate">
            <span className="font-bold truncate mr-2">Draft: {subject || 'New Message'}</span>
            {isSavingDraft && (
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse ml-2"></div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
            }}
            className="text-white hover:text-gray-300"
          >
            <span className="text-white">+</span>
          </button>
        </div>
      ) : (
        <>
          {/* Auto-save progress bar */}
          {isSavingDraft && (
            <div className="h-1 w-full bg-gray-200">
              <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }}></div>
            </div>
          )}

          <div className="p-3 bg-gray-900 text-white flex justify-between items-center cursor-default" onDoubleClick={() => mode === 'modal' && setIsMaximized(!isMaximized)}>
            <h3 className="font-bold px-2">New Message</h3>
            <div className="flex items-center gap-1">
              {mode === 'modal' && (
                <>
                  <button
                    onClick={handlePopout}
                    className="hover:text-gray-300 transition-colors p-1.5 rounded-full hover:bg-gray-800"
                    title="Open in new window"
                  >
                    <ExternalLink size={18} />
                  </button>
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="hover:text-gray-300 transition-colors p-1.5 rounded-full hover:bg-gray-800"
                    title={isMaximized ? "Exit Full Screen" : "Full Screen"}
                  >
                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  <button
                    onClick={() => {
                      onMinimize(windowId);
                      setIsMinimized(true);
                    }}
                    className="hover:text-gray-300 transition-colors p-1.5 rounded-full hover:bg-gray-800"
                    title="Minimize"
                  >
                    <span className="text-white">-</span>
                  </button>
                </>
              )}
              <button
                onClick={() => mode === 'standalone' ? window.close() : onClose(windowId)}
                className="hover:text-gray-300 transition-colors p-1.5 rounded-full hover:bg-gray-800"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6 bg-white flex-shrink-0 z-20">
            <div className="relative border-b border-gray-100 pb-4">
              <div className="flex items-center">
                <span className="text-gray-500 w-16 text-sm font-medium pt-1">To:</span>
                <div className="flex-1 ml-3">
                  <EmailInput
                    value={to}
                    onChange={setTo}
                    placeholder="recipient@example.com"
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                  />
                </div>
              </div>
              {suggestions.length > 0 && (
                <div className="absolute left-16 right-0 top-full bg-white shadow-lg rounded-lg border border-gray-100 z-50 mt-1 max-h-40 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        // Add the selected email to the array if it's not already there
                        if (!to.includes(s.email)) {
                          setTo([...to, s.email]);
                        }
                        setSuggestions([]);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex justify-between"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gray-400">{s.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center border-b border-gray-100 pb-4">
              <span className="text-gray-500 w-16 text-sm font-medium pt-1">Subject:</span>
              <div className="flex-1 ml-3">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="What's this about?"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-white p-4 pt-0">
            <TiptapEditor
              value={body}
              onChange={setBody}
              placeholder="Write your message here..."
              signature={accountSignature || undefined}
            />
          </div>

          <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="text-sm text-gray-500 flex items-center gap-2">
              {isSavingDraft ? (
                <span className="text-blue-600">Sparar...</span>
              ) : showAutoSaved ? (
                <span className="text-green-600">Autosparat</span>
              ) : null}
            </div>
            <button
              onClick={handleSend}
              disabled={isSending}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md shadow-blue-100"
            >
              {isSending ? 'Sending...' : 'Send'}
              <Send size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
