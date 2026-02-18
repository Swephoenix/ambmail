'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Maximize2, Minimize2, ExternalLink, Paperclip, Code, Upload, Cloud, Link2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import TiptapEditor from './TiptapEditor';
import EmailInput from './EmailInput';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: unknown[]) {
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

type ContactSuggestion = {
  id: string;
  email: string;
  name: string | null;
};

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
  }, [initialData, draftUid, accountId, isSwitchingDraft, isDraftLoaded, accountSignature, to, subject, body]);

  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft] = useState(false);
  const [, setLastSaved] = useState<number>(Date.now() - 3000); // Keep setter for draft switch timing
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isSignatureInserted, setIsSignatureInserted] = useState(false);
  const [showHtmlImport, setShowHtmlImport] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState('');
  const [showCsvExport, setShowCsvExport] = useState(false);
  const [csvExportName, setCsvExportName] = useState('ambmail_mejllista');
  const [showNextcloud, setShowNextcloud] = useState(false);
  const [ncPath, setNcPath] = useState('');
  const [ncFiles, setNcFiles] = useState<Array<{ path: string; name: string; isDir: boolean; size: number | null }>>([]);
  const [ncLoading, setNcLoading] = useState(false);
  const [ncError, setNcError] = useState<string | null>(null);
  const [ncConnected, setNcConnected] = useState(false);
  const [ncAction, setNcAction] = useState<string | null>(null);
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
  const csvInputRef = useRef<HTMLInputElement | null>(null);
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

      const uploaded = (result.files || []).map((file: unknown, index: number) => {
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
                `<img src="${previewUrl}" data-ambmail-cid="${cid}" width="${width}" height="${height}" alt="${file.name}">`,
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
    } catch (error: unknown) {
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const extractEmailsFromText = (text: string) => {
    const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return matches.map((email) => email.trim());
  };

  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const emails = extractEmailsFromText(text);
      if (emails.length === 0) {
        toast.error('Inga giltiga e-postadresser hittades i CSV.');
        return;
      }
      const merged = Array.from(new Set([...to, ...emails]));
      setTo(merged);
      toast.success(`${emails.length} adresser importerade från CSV`);
    } catch (error) {
      console.error('Failed to import CSV:', error);
      toast.error('Kunde inte läsa CSV-filen.');
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleCsvExport = (name?: string) => {
    if (to.length === 0) {
      toast.error('Inga adresser att exportera.');
      return;
    }
    const baseName = (name || 'ambmail_mejllista').trim() || 'ambmail_mejllista';
    const safeName = baseName.replace(/[^\w\-]+/g, '_');
    const header = 'email';
    const rows = to.map((email) => email.replace(/"/g, '""'));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openCsvExport = () => {
    if (to.length === 0) {
      toast.error('Inga adresser att exportera.');
      return;
    }
    setCsvExportName('ambmail_mejllista');
    setShowCsvExport(true);
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
            `<img src="${attachment.previewUrl}" data-ambmail-cid="${cid}" width="${width}" height="${height}" alt="${attachment.name}">`
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

  const selectSuggestion = (suggestion: ContactSuggestion) => {
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
        window.dispatchEvent(new CustomEvent('ambmail:sent', {
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
    } catch (error: unknown) {
      console.error('Error sending email:', error);
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  };

  const openHtmlImport = () => {
    setHtmlDraft(body || '');
    setShowHtmlImport(true);
  };

  const applyHtmlImport = () => {
    const trimmed = htmlDraft.trim();
    if (!trimmed) {
      toast.error('Klistra in HTML-kod först');
      return;
    }
    setBody(trimmed);
    setShowHtmlImport(false);
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

  const formatSize = (size?: number | null) => {
    if (!size || size <= 0) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openNextcloudModal = async () => {
    setShowNextcloud(true);
    setNcError(null);
    setNcLoading(true);
    try {
      const statusRes = await fetch('/api/nextcloud/status');
      const status = await statusRes.json();
      if (!statusRes.ok || !status.connected) {
        setNcConnected(false);
        setNcFiles([]);
        setNcPath('');
        return;
      }
      setNcConnected(true);
      const listRes = await fetch(`/api/nextcloud/files?path=${encodeURIComponent('')}`);
      const list = await listRes.json();
      if (!listRes.ok) {
        throw new Error(list.error || 'Kunde inte läsa filer');
      }
      setNcPath(list.path || '');
      setNcFiles(list.entries || []);
    } catch (error: unknown) {
      setNcError(error.message || 'Kunde inte ansluta till Nextcloud');
    } finally {
      setNcLoading(false);
    }
  };

  const loadNextcloudPath = async (pathValue: string) => {
    setNcLoading(true);
    setNcError(null);
    try {
      const res = await fetch(`/api/nextcloud/files?path=${encodeURIComponent(pathValue)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte läsa filer');
      }
      setNcPath(data.path || '');
      setNcFiles(data.entries || []);
    } catch (error: unknown) {
      setNcError(error.message || 'Kunde inte läsa filer');
    } finally {
      setNcLoading(false);
    }
  };

  const handleNextcloudAttach = async (filePath: string) => {
    setNcAction(filePath);
    try {
      const res = await fetch('/api/nextcloud/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte hämta filen');
      }
      setAttachments((prev) => [
        ...prev,
        {
          token: data.token,
          name: data.name,
          size: data.size,
          type: data.type || 'application/octet-stream',
          inline: false,
        },
      ]);
      toast.success('Fil bifogad');
    } catch (error: unknown) {
      toast.error(error.message || 'Kunde inte bifoga filen');
    } finally {
      setNcAction(null);
    }
  };

  const handleNextcloudLink = async (filePath: string) => {
    setNcAction(filePath);
    try {
      const res = await fetch('/api/nextcloud/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte skapa länk');
      }
      const label = filePath.split('/').filter(Boolean).pop() || 'Nextcloud-fil';
      const linkHtml = `<p><a href="${data.url}">${label}</a></p>`;
      if (insertContentRef.current) {
        insertContentRef.current(linkHtml);
      } else {
        setBody((prev) => `${prev || ''}${linkHtml}`);
      }
      toast.success('Länk infogad');
    } catch (error: unknown) {
      toast.error(error.message || 'Kunde inte skapa länk');
    } finally {
      setNcAction(null);
    }
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
                <div className="flex-1 ml-3 flex items-center gap-2">
                  <EmailInput
                    value={to}
                    onChange={setTo}
                    placeholder="recipient@example.com"
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                    onKeyDown={handleSuggestionKeyDown}
                    className={to.length > 3 ? "max-h-24 overflow-y-auto pr-1 items-start" : undefined}
                  />
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                        onClick={() => csvInputRef.current?.click()}
                        title="Importera adresser från CSV"
                      >
                        <Upload size={16} />
                        Importera CSV
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                        onClick={openCsvExport}
                        title="Exportera mejllista som CSV"
                      >
                        Exportera mejllista som CSV
                      </button>
                    </div>
                    <span className="mt-1 text-xs text-gray-500">{to.length} adresser</span>
                  </div>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleCsvSelect}
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
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                  onClick={openHtmlImport}
                >
                  <Code size={16} />
                  Importera HTML
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                  onClick={openNextcloudModal}
                >
                  <Cloud size={16} />
                  Nextcloud
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
          {showHtmlImport && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowHtmlImport(false)}
                aria-label="Close HTML import"
              />
              <div className="relative w-full max-w-2xl mx-4 rounded-xl bg-white shadow-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900">Importera HTML</h4>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setShowHtmlImport(false)}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Klistra in HTML-koden som ska bli mejlets innehåll.
                </p>
                <textarea
                  value={htmlDraft}
                  onChange={(e) => setHtmlDraft(e.target.value)}
                  className="mt-3 h-64 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="<html>...</html>"
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowHtmlImport(false)}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    onClick={applyHtmlImport}
                  >
                    Skapa mejl
                  </button>
                </div>
              </div>
            </div>
          )}
          {showCsvExport && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowCsvExport(false)}
                aria-label="Close CSV export"
              />
              <div className="relative w-full max-w-lg mx-4 rounded-xl bg-white shadow-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900">Exportera mejllista</h4>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setShowCsvExport(false)}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Ange ett namn på listan (lämna tomt för standard).
                </p>
                <input
                  value={csvExportName}
                  onChange={(e) => setCsvExportName(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ambmail_mejllista"
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowCsvExport(false)}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                      handleCsvExport(csvExportName);
                      setShowCsvExport(false);
                    }}
                  >
                    Exportera
                  </button>
                </div>
              </div>
            </div>
          )}
          {showNextcloud && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowNextcloud(false)}
                aria-label="Close Nextcloud"
              />
              <div className="relative w-full max-w-3xl mx-4 rounded-xl bg-white shadow-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Nextcloud</h4>
                    <p className="text-sm text-gray-500">Välj filer att bifoga eller länka.</p>
                  </div>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setShowNextcloud(false)}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                {!ncConnected ? (
                  <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-4 text-center">
                    <p className="text-sm text-gray-600">Du behöver logga in till Nextcloud för att se dina filer.</p>
                    <p className="mt-2 text-xs text-gray-500">Om OAuth2 saknas, kontakta admin.</p>
                    <a
                      href="/api/nextcloud/auth/start"
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      <Cloud size={16} />
                      Anslut Nextcloud
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        Mapp: /{ncPath || ''}
                      </div>
                      {ncPath && (
                        <button
                          type="button"
                          className="text-sm text-blue-600 hover:text-blue-800"
                          onClick={() => {
                            const parent = ncPath.replace(/\/?[^/]+\/?$/, '');
                            loadNextcloudPath(parent);
                          }}
                        >
                          ⬅ Upp en nivå
                        </button>
                      )}
                    </div>
                    {ncError && <p className="mt-2 text-sm text-red-600">{ncError}</p>}
                    <div className="mt-3 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                      {ncLoading ? (
                        <div className="p-4 text-sm text-gray-500">Laddar…</div>
                      ) : ncFiles.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">Inga filer hittades.</div>
                      ) : (
                        ncFiles.map((item) => (
                          <div key={item.path} className="flex items-center justify-between p-3">
                            <button
                              type="button"
                              className={`flex items-center gap-2 text-sm ${item.isDir ? 'text-blue-700' : 'text-gray-800'} hover:underline`}
                              onClick={() => {
                                if (item.isDir) {
                                  loadNextcloudPath(item.path);
                                }
                              }}
                            >
                              <span>{item.isDir ? '📁' : '📄'}</span>
                              <span className="truncate">{item.name || item.path}</span>
                              {!item.isDir && item.size ? (
                                <span className="text-xs text-gray-400">{formatSize(item.size)}</span>
                              ) : null}
                            </button>
                            {!item.isDir && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                                  onClick={() => handleNextcloudAttach(item.path)}
                                  disabled={ncAction === item.path}
                                >
                                  <Download size={14} />
                                  {ncAction === item.path ? 'Bifogar…' : 'Bifoga'}
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                  onClick={() => handleNextcloudLink(item.path)}
                                  disabled={ncAction === item.path}
                                >
                                  <Link2 size={14} />
                                  {ncAction === item.path ? 'Skapar…' : 'Skapa länk'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
