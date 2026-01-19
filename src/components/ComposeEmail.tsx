'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Maximize2, Minimize2, ExternalLink, Paperclip } from 'lucide-react';
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
  }, [initialData, draftUid, accountId, isSwitchingDraft, isDraftLoaded, accountSignature]);

  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<number>(Date.now() - 3000); // Initialize to 3 seconds ago to avoid initial trigger
  const [showAutoSaved, setShowAutoSaved] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isSignatureInserted, setIsSignatureInserted] = useState(false);
  const [attachments, setAttachments] = useState<Array<{
    token: string;
    name: string;
    size: number;
    type: string;
    inline: boolean;
    cid?: string;
    previewUrl?: string;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const insertContentRef = useRef<(html: string, insertPos?: number) => void>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef(attachments);

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
      } else if (!initialData?.body && !body) {
        // Ensure the cursor starts above the signature
        setBody(`<p></p>${accountSignature}`);
        setIsSignatureInserted(true);
      } else if (body && !body.includes(accountSignature)) {
        // Signature is not in the body yet, add it at the end
        setBody(prevBody => prevBody ? `${prevBody}<br /><br />${accountSignature}` : accountSignature);
        setIsSignatureInserted(true);
      }
    }
  }, [accountSignature, isSignatureInserted, initialData?.uid, body, initialData?.body]);

  const uploadFiles = async (files: File[], inlineByDefault = false, insertPos?: number) => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const res = await fetch('/api/mail/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      const uploaded = (result.files || []).map((file: any, index: number) => {
        const localFile = files[index];
        const type = file.type || localFile?.type || '';
        const inline = inlineByDefault && type.startsWith('image/');
        const cid = inline ? `inline-${file.token}` : undefined;
        const previewUrl = localFile && type.startsWith('image/')
          ? URL.createObjectURL(localFile)
          : undefined;
        if (inline && insertContentRef.current) {
          if (previewUrl) {
            const img = new window.Image();
            img.onload = () => {
              const naturalWidth = img.naturalWidth || 0;
              const naturalHeight = img.naturalHeight || 0;
              const maxWidth = 600;
              const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
              const width = Math.round(naturalWidth * scale);
              const height = Math.round(naturalHeight * scale);
              insertContentRef.current?.(
                `<img src="${previewUrl}" data-uxmail-cid="${cid}" width="${width}" height="${height}" alt="${file.name}">`,
                insertPos
              );
            };
            img.src = previewUrl;
          } else {
            insertContentRef.current(`<img src="cid:${cid}" alt="${file.name}">`, insertPos);
          }
        }
        return {
          token: file.token,
          name: file.name,
          size: file.size,
          type,
          inline,
          cid,
          previewUrl,
        };
      });

      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    await uploadFiles(files, false);
    if (event.target) {
      event.target.value = '';
    }
  };

  const insertInlineImage = (attachmentToken: string) => {
    const attachment = attachments.find((item) => item.token === attachmentToken);
    if (!attachment || !attachment.type.startsWith('image/') || attachment.inline) return;
    const cid = `inline-${attachment.token}`;
    if (insertContentRef.current) {
      if (attachment.previewUrl) {
        const img = new window.Image();
        img.onload = () => {
          const naturalWidth = img.naturalWidth || 0;
          const naturalHeight = img.naturalHeight || 0;
          const maxWidth = 600;
          const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
          const width = Math.round(naturalWidth * scale);
          const height = Math.round(naturalHeight * scale);
          insertContentRef.current?.(
            `<img src="${attachment.previewUrl}" data-uxmail-cid="${cid}" width="${width}" height="${height}" alt="${attachment.name}">`
          );
        };
        img.src = attachment.previewUrl;
      } else {
        insertContentRef.current(`<img src="cid:${cid}" alt="${attachment.name}">`);
      }
    }
    setAttachments((prev) =>
      prev.map((item) =>
        item.token === attachmentToken ? { ...item, inline: true, cid } : item
      )
    );
  };

  const removeAttachment = (attachmentToken: string) => {
    const attachment = attachments.find((item) => item.token === attachmentToken);
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachments((prev) => prev.filter((item) => item.token !== attachmentToken));
  };

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

  // Ref to store the timeout ID for proper cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to store the timeout ID for the auto-saved indicator
  const autoSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to store the last saved content to avoid unnecessary saves
  const lastSavedContentRef = useRef({
    to: Array.isArray(initialData?.to) ? initialData.to :
         typeof initialData?.to === 'string' ?
           initialData.to.split(/[,\s;]+/).map(email => email.trim()).filter(email => email !== '') :
           [],
    subject: initialData?.subject || '',
    body: initialData?.body || ''
  });

  // Temporarily disable auto-save functionality to prevent field clearing issues
  // Save draft when component unmounts (when closing the email)
  /*useEffect(() => {
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
            finalBody = body ? `${body}<br /><br />${accountSignature}` : accountSignature;
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
  }, [to, subject, body, draftUid, accountId, isSending, isSwitchingDraft, accountSignature]);*/

  // Function to manually save draft (useful when switching between emails)
  // Temporarily disabled to prevent field clearing issues
  /*const saveDraftNow = async () => {
    // If the signature is not already in the body, add it
    let finalBody = body;
    if (accountSignature && !body.includes(accountSignature)) {
      finalBody = body ? `${body}<br /><br />${accountSignature}` : accountSignature;
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
  };*/

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

  useEffect(() => {
    setActiveSuggestionIndex(suggestions.length > 0 ? 0 : -1);
  }, [suggestions]);

  const selectSuggestion = (suggestion: any) => {
    if (!to.includes(suggestion.email)) {
      setTo([...to, suggestion.email]);
    }
    setInputValue('');
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  };

  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestionIndex]);
    }
  };

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
    for (const attachment of attachments) {
      if (!attachment.inline || !attachment.cid || !attachment.previewUrl) continue;
      finalBody = finalBody.split(attachment.previewUrl).join(`cid:${attachment.cid}`);
    }
    const attachmentsToSend = attachments.filter((item) => {
      if (!item.inline) return true;
      if (!item.cid) return false;
      return finalBody.includes(`cid:${item.cid}`);
    });

    console.log('Sending email with data:', { accountId, to: toEmails, subject, body: finalBody.substring(0, 100) + '...' });
    setIsSending(true);
    try {
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          to: toEmails,
          subject,
          body: finalBody,
          attachments: attachmentsToSend.map((item) => ({
            token: item.token,
            filename: item.name,
            contentType: item.type,
            inline: item.inline,
            cid: item.cid,
          })),
        }),
      });

      const result = await res.json();
      console.log('Send API response:', result);

      if (!res.ok) {
        console.error('Failed to send email:', result.error);
        throw new Error(result.error || 'Failed to send email');
      }

      toast.success('Email sent!');
      if (result.sentFolder) {
        window.dispatchEvent(new CustomEvent('uxmail:sent', {
          detail: { accountId, folder: result.sentFolder }
        }));
      }
      attachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
      setAttachments([]);
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
                    onKeyDown={handleSuggestionKeyDown}
                  />
                </div>
              </div>
              {suggestions.length > 0 && (
                <div className="absolute left-16 right-0 top-full bg-white shadow-lg rounded-lg border border-gray-100 z-50 mt-1 max-h-40 overflow-y-auto">
                  {suggestions.map((s, index) => (
                    <button
                      key={s.id}
                      onClick={() => selectSuggestion(s)}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm flex justify-between",
                        index === activeSuggestionIndex ? "bg-gray-100" : "hover:bg-gray-50"
                      )}
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
            <div className="flex items-center justify-between pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={16} />
                  {isUploading ? 'Laddar upp...' : 'Bifoga filer'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {attachments.filter((attachment) => !attachment.inline).length > 0 && (
                <span className="text-xs text-gray-500">
                  {attachments.filter((attachment) => !attachment.inline).length} bilagor
                </span>
              )}
            </div>
            {attachments.filter((attachment) => !attachment.inline).length > 0 && (
              <div className="mt-3 border border-gray-200 rounded-lg p-3 space-y-2">
                {attachments
                  .filter((attachment) => !attachment.inline)
                  .map((attachment) => (
                  <div key={attachment.token} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{attachment.name}</span>
                      <span className="text-xs text-gray-400">
                        {Math.round(attachment.size / 1024)} KB
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {attachment.type.startsWith('image/') && (
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:text-blue-800"
                          onClick={() => insertInlineImage(attachment.token)}
                        >
                          Infoga i mejl
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-800"
                        onClick={() => removeAttachment(attachment.token)}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-white p-4 pt-0">
            <TiptapEditor
              value={body}
              onChange={setBody}
              placeholder="Write your message here..."
              signature={accountSignature || undefined}
              onRegisterInsert={(insert) => {
                insertContentRef.current = insert;
              }}
              onFilesDropped={(files, insertPos) => uploadFiles(files, true, insertPos)}
            />
          </div>

          <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="text-sm text-gray-500 flex items-center gap-2">
              {/* Removed auto-save indicators to prevent field clearing issues */}
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
