'use client';

import { useEffect, useRef, useState, type WheelEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { format } from 'date-fns';
import { Reply, ReplyAll, Forward, Trash2, MoreHorizontal, FolderInput, User, ChevronDown, ChevronUp, File, FileArchive, FileImage, FileSpreadsheet, FileText, Mail, ZoomIn, ZoomOut, RefreshCcw, X } from 'lucide-react';

interface MailViewProps {
  email: any | null;
  isLoading: boolean;
  onReply?: (email: any) => void;
  onReplyAll?: (email: any) => void;
  onForward?: (email: any) => void;
  onDelete?: (email: any) => void;
  onMoveToFolder?: (email: any) => void;
  onMarkUnread?: (email: any) => void;
  onComposeTo?: (address: string) => void;
}

interface Recipient {
  name: string;
  address: string;
}

interface AttachmentMeta {
  filename: string;
  contentType?: string;
  size?: number;
  contentId?: string | null;
  contentDisposition?: string | null;
  isInline?: boolean;
}

function parseAddress(input: string): Recipient {
  // Matches: "Name" <email@domain.com> or Name <email@domain.com> or <email@domain.com> or email@domain.com
  const match = input.match(/(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)/);
  if (match) {
    const name = (match[1] || '').trim();
    const address = (match[2] || input).trim();
    return { name: name || address, address };
  }
  return { name: input, address: input };
}

function parseRecipients(input: string): Recipient[] {
  if (!input) return [];
  // Split by comma, ignoring commas inside quotes
  const parts = input.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  return parts.map(part => parseAddress(part.trim())).filter(r => r.address);
}

export default function MailView({
  email,
  isLoading,
  onReply = () => {},
  onReplyAll = () => {},
  onForward = () => {},
  onDelete = () => {},
  onMoveToFolder = () => {},
  onMarkUnread = () => {},
  onComposeTo = () => {}
}: MailViewProps) {
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [expandedAttachments, setExpandedAttachments] = useState<number[]>([]);
  const [isMimeOpen, setIsMimeOpen] = useState(false);
  const [mimeContent, setMimeContent] = useState('');
  const [mimeLoading, setMimeLoading] = useState(false);
  const [mimeError, setMimeError] = useState('');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const emailContentRef = useRef<HTMLDivElement | null>(null);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };
  const formatTimestamp = (value?: string | Date | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return format(date, 'yyyy-MM-dd HH:mm');
  };

  useEffect(() => {
    setIsMimeOpen(false);
    setMimeContent('');
    setMimeLoading(false);
    setMimeError('');
    setIsMoreOpen(false);
    setImagePreview(null);
  }, [email?.uid, email?.folder, email?.accountId]);

  useEffect(() => {
    const container = emailContentRef.current;
    if (!container) return;

    const handleImageClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName !== 'IMG') return;
      const img = target as HTMLImageElement;
      const src = img.currentSrc || img.src;
      if (!src) return;
      event.preventDefault();
      event.stopPropagation();
      setImagePreview({ src, alt: img.alt || 'Inline image' });
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    };

    container.addEventListener('click', handleImageClick);
    return () => container.removeEventListener('click', handleImageClick);
  }, [email?.uid, email?.folder, email?.accountId]);

  useEffect(() => {
    if (!imagePreview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImagePreview(null);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imagePreview]);

  const clampZoom = (value: number) => Math.min(6, Math.max(0.2, value));

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.12 : 0.12;
    setZoomLevel(current => clampZoom(current + direction));
  };

  const handlePanStart = (event: ReactMouseEvent<HTMLImageElement>) => {
    setIsPanning(true);
    lastPanPoint.current = { x: event.clientX, y: event.clientY };
  };

  const handlePanMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    const deltaX = event.clientX - lastPanPoint.current.x;
    const deltaY = event.clientY - lastPanPoint.current.y;
    lastPanPoint.current = { x: event.clientX, y: event.clientY };
    setPanOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-gray-500">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-4 w-48 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 w-32 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-gray-400">
        <div className="p-8 border-2 border-dashed border-gray-100 rounded-full mb-4">
          <User size={48} />
        </div>
        <p className="text-lg font-medium">Select a message to read</p>
      </div>
    );
  }

  const from = parseAddress(email.from);
  // Use server-side parsed recipients if available to improve performance, 
  // otherwise fallback to client-side parsing
  const recipients: Recipient[] = email.toRecipients || parseRecipients(email.to || '');
  const displayRecipients = showAllRecipients ? recipients : recipients.slice(0, 3);
  const remainingCount = recipients.length - 3;
  const attachments: AttachmentMeta[] = email.attachments || [];
  const visibleAttachments = attachments.filter(
    attachment => !(attachment.isInline || attachment.contentDisposition === 'inline' || Boolean(attachment.contentId))
  );
  const toggleAttachment = (index: number) => {
    setExpandedAttachments(prev =>
      prev.includes(index) ? prev.filter(item => item !== index) : [...prev, index]
    );
  };

  const getAttachmentName = (attachment: AttachmentMeta, index: number, inlineIndex: number) => {
    const rawName = attachment.filename || '';
    const placeholderName = rawName.trim().toLowerCase() === 'attachment';
    if (attachment.contentType?.startsWith('image/') && (attachment.isInline || attachment.contentId) && placeholderName) {
      return `Inline image ${inlineIndex}`;
    }
    return rawName || `attachment-${index}`;
  };

  const attachmentTotals = visibleAttachments.reduce((total, attachment) => {
    return total + (attachment.size || 0);
  }, 0);
  const isRead = Array.isArray(email.flags) && email.flags.includes('\\Seen');

  const isPreviewable = (contentType?: string) => {
    if (!contentType) return false;
    return contentType.startsWith('image/') || contentType === 'application/pdf';
  };

  const getAttachmentIcon = (contentType?: string) => {
    if (!contentType) return <File size={20} />;
    if (contentType.startsWith('image/')) return <FileImage size={20} />;
    if (contentType === 'application/pdf' || contentType.startsWith('text/')) return <FileText size={20} />;
    if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv')) {
      return <FileSpreadsheet size={20} />;
    }
    if (contentType.includes('zip') || contentType.includes('compressed')) return <FileArchive size={20} />;
    return <File size={20} />;
  };

  const handleOpenMime = async () => {
    if (!email?.accountId || !email?.uid || !email?.folder) return;
    setIsMimeOpen(true);
    if (mimeContent || mimeLoading) return;
    setMimeLoading(true);
    setMimeError('');
    try {
      const res = await fetch(
        `/api/mail/mime?accountId=${encodeURIComponent(email.accountId)}&uid=${email.uid}&folder=${encodeURIComponent(email.folder)}`
      );
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Failed to fetch MIME');
      }
      const text = await res.text();
      setMimeContent(text);
    } catch (error: any) {
      setMimeError(error?.message || 'Failed to fetch MIME');
    } finally {
      setMimeLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onReply(email)}
            className="px-3 py-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors inline-flex items-center gap-2 text-sm font-medium"
            title="Svara"
          >
            <Reply size={18} />
            Svara
          </button>
          <button
            onClick={() => onReplyAll(email)}
            className="px-3 py-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors inline-flex items-center gap-2 text-sm font-medium"
            title="Svara alla"
          >
            <ReplyAll size={18} />
            Svara alla
          </button>
          <button
            onClick={() => onForward(email)}
            className="px-3 py-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors inline-flex items-center gap-2 text-sm font-medium"
            title="Vidarebefordra"
          >
            <Forward size={18} />
            Vidarebefordra
          </button>
          <button
            onClick={() => onDelete(email)}
            className="p-2 hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-600 transition-colors"
            title="Radera"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={() => onMoveToFolder(email)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            title="Flytta till mapp"
          >
            <FolderInput size={20} />
          </button>
          {isRead && (
            <button
              onClick={() => onMarkUnread(email)}
              className="px-3 py-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors inline-flex items-center gap-2 text-sm font-medium"
              title="Markera som oläst"
            >
              <Mail size={18} />
              Markera som oläst
            </button>
          )}
        </div>
        <div className="relative">
          <button
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            onClick={() => setIsMoreOpen(prev => !prev)}
            title="Fler alternativ"
          >
            <MoreHorizontal size={20} />
          </button>
          {isMoreOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  handleOpenMime();
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FileText size={16} />
                Visa MIME
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">{email.subject}</h1>

            <div className="bg-gray-50 rounded-lg p-4 mb-8">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold mr-4 shrink-0">
              {from.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline flex-wrap gap-2">
                <div className="font-semibold text-gray-900 truncate">
                  {from.name}
                  <span className="text-gray-500 font-normal ml-2 text-sm hidden sm:inline">&lt;{from.address}&gt;</span>
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap">{formatTimestamp(email.date)}</span>
              </div>
              
              <div className="mt-1">
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-sm text-gray-500 mr-1">To:</span>
                  {displayRecipients.map((recipient, index) => (
                    <span 
                      key={index} 
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800 cursor-pointer hover:bg-gray-300 transition-colors select-none"
                      title={`Double-click to compose email to ${recipient.address}`}
                      onDoubleClick={() => onComposeTo(recipient.address)}
                    >
                      {recipient.name === recipient.address 
                        ? recipient.address 
                        : `${recipient.name} <${recipient.address}>`}
                    </span>
                  ))}
                  {!showAllRecipients && remainingCount > 0 && (
                    <button 
                      onClick={() => setShowAllRecipients(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                    >
                      +{remainingCount} others <ChevronDown size={12} className="ml-1" />
                    </button>
                  )}
                  {showAllRecipients && recipients.length > 3 && (
                    <button 
                      onClick={() => setShowAllRecipients(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center px-2 py-0.5 rounded hover:bg-gray-200 transition-colors ml-auto"
                    >
                      Show less <ChevronUp size={12} className="ml-1" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

            {visibleAttachments.length > 0 && (
              <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Attachments ({visibleAttachments.length})
              </h3>
              {attachmentTotals > 0 ? (
                <span className="text-xs text-gray-500">{formatBytes(attachmentTotals)}</span>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleAttachments.map((attachment, index) => {
                const displayName = getAttachmentName(attachment, index, index + 1);
                return (
                <div key={index} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
                      {getAttachmentIcon(attachment.contentType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 truncate">
                        {displayName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {attachment.contentType || 'Unknown type'}
                        {attachment.size ? ` • ${formatBytes(attachment.size)}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isPreviewable(attachment.contentType) && (
                      <button
                        onClick={() => toggleAttachment(index)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        {expandedAttachments.includes(index) ? 'Hide preview' : 'Preview'}
                      </button>
                    )}
                    <a
                      href={`/api/mail/attachment?accountId=${encodeURIComponent(email.accountId)}&folder=${encodeURIComponent(email.folder)}&uid=${email.uid}&index=${index}`}
                      className="text-xs font-semibold text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Download
                    </a>
                  </div>
                  {expandedAttachments.includes(index) && attachment.contentType?.startsWith('image/') && (
                    <img
                      src={`/api/mail/attachment?accountId=${encodeURIComponent(email.accountId)}&folder=${encodeURIComponent(email.folder)}&uid=${email.uid}&index=${index}&inline=1`}
                      alt={displayName}
                      className="max-w-full max-h-96 rounded-lg border border-gray-200"
                      loading="lazy"
                    />
                  )}
                  {expandedAttachments.includes(index) && attachment.contentType === 'application/pdf' && (
                    <iframe
                      src={`/api/mail/attachment?accountId=${encodeURIComponent(email.accountId)}&folder=${encodeURIComponent(email.folder)}&uid=${email.uid}&index=${index}&inline=1`}
                      title={displayName}
                      className="w-full h-96 rounded-lg border border-gray-200"
                    />
                  )}
                </div>
              )})}
            </div>
          </div>
        )}

            <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
              {/* In a real app we'd handle HTML/Sanitization */}
              <div
                ref={emailContentRef}
                className="email-content"
                dangerouslySetInnerHTML={{ __html: email.body || 'No content' }}
              />
            </div>
          </div>
        </div>
      </div>

      {isMimeOpen && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-700">MIME-kod</div>
              <button
                onClick={() => setIsMimeOpen(false)}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Stang
              </button>
            </div>
            <div className="p-4 overflow-auto text-xs font-mono text-gray-800 whitespace-pre-wrap">
              {mimeLoading && <div className="text-gray-500">Hamta MIME-kod...</div>}
              {!mimeLoading && mimeError && <div className="text-red-600">{mimeError}</div>}
              {!mimeLoading && !mimeError && (mimeContent || 'Ingen MIME-kod hittades.')}
            </div>
          </div>
        </div>
      )}

      {imagePreview && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setImagePreview(null);
            }
          }}
        >
          <div className="relative w-full h-full max-w-6xl max-h-[90vh] bg-gray-900/80 rounded-2xl border border-white/10 overflow-hidden">
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <button
                onClick={() => setZoomLevel(current => clampZoom(current + 0.2))}
                className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
                title="Zooma in"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => setZoomLevel(current => clampZoom(current - 0.2))}
                className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
                title="Zooma ut"
              >
                <ZoomOut size={18} />
              </button>
              <button
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
                title="Aterstall vy"
              >
                <RefreshCcw size={18} />
              </button>
              <button
                onClick={() => setImagePreview(null)}
                className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
                title="Stang"
              >
                <X size={18} />
              </button>
            </div>
            <div
              className="absolute inset-0 flex items-center justify-center"
              onWheel={handleWheelZoom}
              onMouseMove={handlePanMove}
              onMouseUp={handlePanEnd}
              onMouseLeave={handlePanEnd}
            >
              <img
                src={imagePreview.src}
                alt={imagePreview.alt}
                onMouseDown={handlePanStart}
                draggable={false}
                className={`max-w-full max-h-full select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'center',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
