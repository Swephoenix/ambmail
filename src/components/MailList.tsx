'use client';

import { useEffect, useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { RefreshCcw, Search, Trash2, CheckCircle, Square, Star, Tag, Mail, CircleX } from 'lucide-react';

export interface EmailHeader {
  uid: number;
  subject: string;
  from: string;
  to?: string;
  date: string | Date | null;
  flags: string[];
  labels?: string[];
  preview?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

export interface LabelOption {
  name: string;
  colorHex: string;
  textHex: string;
}

interface MailListProps {
  emails: EmailHeader[];
  selectedEmailUid: number | null;
  onEmailSelect: (uid: number) => void;
  onToggleRead: (uid: number, isRead: boolean) => void;
  onToggleStar: (uid: number, isStarred: boolean) => void;
  onToggleLabel: (uid: number, label: string, isApplied: boolean) => void;
  onOpenLabelManager: () => void;
  onDeleteEmail?: (uid: number) => void;
  onPermanentDeleteEmail?: (uid: number) => void;
  onPermanentDeleteSelected?: () => void;
  allowPermanentDelete?: boolean;
  showStarredOnly: boolean;
  onToggleStarFilter: () => void;
  activeLabelFilter: string | null;
  onSelectLabelFilter: (label: string | null) => void;
  isLoading: boolean;
  onRefresh: () => void;
  folderName: string;
  labelOptions: LabelOption[];
  // New props for multi-select functionality
  selectedEmails?: number[];
  onEmailSelectToggle?: (uid: number) => void;
  onSelectAll?: () => void;
  onDeleteSelected?: () => void;
  onMoveSelected?: (targetFolder: string) => void;
  onEmptyTrash?: () => void;
  showEmptyTrash?: boolean;
}

export default function MailList({
  emails,
  selectedEmailUid,
  onEmailSelect,
  onToggleRead,
  onToggleStar,
  onToggleLabel,
  onOpenLabelManager,
  onDeleteEmail = () => {},
  onPermanentDeleteEmail = () => {},
  onPermanentDeleteSelected = () => {},
  allowPermanentDelete = false,
  showStarredOnly,
  onToggleStarFilter,
  activeLabelFilter,
  onSelectLabelFilter,
  isLoading,
  onRefresh,
  folderName,
  labelOptions,
  selectedEmails = [],
  onEmailSelectToggle = () => {},
  onSelectAll = () => {},
  onDeleteSelected = () => {},
  onMoveSelected = () => {},
  onEmptyTrash = () => {},
  showEmptyTrash = false
}: MailListProps) {
  const isAllSelected = emails.length > 0 && emails.every(email => selectedEmails.includes(email.uid));
  const [labelMenuUid, setLabelMenuUid] = useState<number | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [bulkLabelMenuOpen, setBulkLabelMenuOpen] = useState(false);
  const emailByUid = useMemo(() => {
    return emails.reduce<Record<number, EmailHeader>>((acc, email) => {
      acc[email.uid] = email;
      return acc;
    }, {});
  }, [emails]);
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-label-menu]')) {
        setLabelMenuUid(null);
        setBulkLabelMenuOpen(false);
      }
      if (!target?.closest('[data-filter-menu]')) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const formatTimestamp = (value: string | Date | null) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    if (isToday(date)) {
      return `idag kl ${format(date, 'HH:mm')}`;
    }
    if (isYesterday(date)) {
      return `igår kl ${format(date, 'HH:mm')}`;
    }
    return format(date, 'd MMM yyyy HH:mm', { locale: sv });
  };

  const handleBulkStar = () => {
    selectedEmails.forEach((uid) => {
      const email = emailByUid[uid];
      const isStarred = email?.flags?.includes('\\Flagged');
      if (!isStarred) {
        onToggleStar(uid, false);
      }
    });
  };

  const handleBulkLabel = (labelName: string) => {
    selectedEmails.forEach((uid) => {
      const email = emailByUid[uid];
      const appliedLabels = email?.labels || [];
      if (!appliedLabels.includes(labelName)) {
        onToggleLabel(uid, labelName, false);
      }
    });
    setBulkLabelMenuOpen(false);
  };

  return (
    <div className="w-80 md:w-96 flex flex-col h-full border-r border-gray-200 bg-white">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold capitalize">{folderName.toLowerCase()}</h2>
          {selectedEmails.length > 0 && (
            <span className="text-sm text-gray-500">({selectedEmails.length} selected)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedEmails.length > 0 ? (
            <>
              <button
                onClick={handleBulkStar}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Stjarnmark valda"
              >
                <Star size={18} className="text-yellow-500" />
              </button>
              <div className="relative" data-label-menu>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setBulkLabelMenuOpen(prev => !prev);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="Etiketter"
                >
                  <Tag size={18} className="text-gray-500" />
                </button>
                {bulkLabelMenuOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-20">
                    <div className="text-[10px] uppercase text-gray-400 px-1 pb-1">Etiketter</div>
                    {labelOptions.length === 0 && (
                      <div className="px-2 py-1 text-xs text-gray-400">Inga etiketter</div>
                    )}
                    {labelOptions.map((label) => (
                      <button
                        key={label.name}
                        onClick={() => handleBulkLabel(label.name)}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-50"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.colorHex }} />
                        <span className="text-xs text-gray-700">{label.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setBulkLabelMenuOpen(false);
                        onOpenLabelManager();
                      }}
                      className="mt-1 w-full text-left rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      Hantera etiketter
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={onDeleteSelected}
                className={`p-2 rounded-full transition-colors ${allowPermanentDelete ? 'cursor-not-allowed' : 'hover:bg-gray-100'}`}
                title="Flytta valda till papperskorgen"
                aria-disabled={allowPermanentDelete}
              >
                <Trash2 size={18} className={allowPermanentDelete ? 'text-gray-300' : 'text-red-500'} />
              </button>
              <button
                onClick={onPermanentDeleteSelected}
                className={`p-2 rounded-full transition-colors ${allowPermanentDelete ? 'hover:bg-gray-100' : 'cursor-not-allowed'}`}
                title="Radera valda permanent"
                aria-disabled={!allowPermanentDelete}
              >
                <CircleX size={18} className={allowPermanentDelete ? 'text-red-500' : 'text-gray-300'} />
              </button>
            </>
          ) : (
            <>
              {showEmptyTrash && (
                <button
                  onClick={onEmptyTrash}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="Empty trash"
                  disabled={emails.length === 0}
                >
                  <Trash2 size={18} className={emails.length === 0 ? 'text-gray-300' : 'text-red-500'} />
                </button>
              )}
              <button
                onClick={onRefresh}
                className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${isLoading ? 'animate-spin' : ''}`}
              >
                <RefreshCcw size={18} className="text-gray-500" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search mail..."
            className="w-full pl-10 pr-16 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute right-2 top-2.5 flex items-center gap-2">
            <button
              onClick={onToggleStarFilter}
              title={showStarredOnly ? 'Visa alla' : 'Visa stjarnmarkerade'}
              aria-pressed={showStarredOnly}
              className="flex h-4 w-4 items-center justify-center"
            >
              <Star
                size={16}
                className={showStarredOnly ? 'text-yellow-500' : 'text-gray-400'}
                fill={showStarredOnly ? 'currentColor' : 'none'}
              />
            </button>
            <div className="relative" data-filter-menu>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setFilterMenuOpen(prev => !prev);
                }}
                title={activeLabelFilter ? `Etikett: ${activeLabelFilter}` : 'Filtrera etiketter'}
                aria-pressed={Boolean(activeLabelFilter)}
                className="flex h-4 w-4 items-center justify-center"
              >
                <Tag size={16} className={activeLabelFilter ? 'text-blue-600' : 'text-gray-400'} />
              </button>
              {filterMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-20">
                  <div className="text-[10px] uppercase text-gray-400 px-1 pb-1">Filter</div>
                  <button
                    onClick={() => {
                      onSelectLabelFilter(null);
                      setFilterMenuOpen(false);
                    }}
                    className="w-full text-left rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Alla etiketter
                  </button>
                  {labelOptions.length === 0 && (
                    <div className="px-2 py-1 text-xs text-gray-400">Inga etiketter</div>
                  )}
                  {labelOptions.map((label) => {
                    const isActive = activeLabelFilter === label.name;
                    return (
                      <button
                        key={label.name}
                        onClick={() => {
                          onSelectLabelFilter(label.name);
                          setFilterMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-50"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.colorHex }} />
                          <span className="text-xs text-gray-700">{label.name}</span>
                        </span>
                        {isActive && <CheckCircle size={14} className="text-blue-500" />}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      setFilterMenuOpen(false);
                      onOpenLabelManager();
                    }}
                    className="mt-1 w-full text-left rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    Skapa/hantera etiketter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && emails.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Loading messages...</div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No messages found</div>
        ) : (
          <>
            {emails.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400">
                <button
                  onClick={onSelectAll}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={isAllSelected ? "Deselect all" : "Select all"}
                >
                  {isAllSelected ? (
                    <CheckCircle size={18} className="text-blue-600" />
                  ) : (
                    <Square size={18} className="text-gray-400" />
                  )}
                </button>
                <div className="flex-1 grid grid-cols-[minmax(0,1fr)_140px] gap-3">
                  <span>From/Subject</span>
                  <span className="text-right">Datum/tid</span>
                </div>
              </div>
            )}
            {emails.map((email) => {
              const isRead = email.flags.includes('\\Seen');
              const isStarred = email.flags.includes('\\Flagged');
              const isSelected = selectedEmails.includes(email.uid);
              const appliedLabels = email.labels || [];
              return (
                <div key={email.uid} className="relative group">
                  <div
                    className={`flex items-start p-4 border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                      selectedEmailUid === email.uid ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    } ${isSelected ? 'bg-blue-100' : ''}`}
                  >
                    <button
                      onClick={() => onEmailSelectToggle(email.uid)}
                      className="mr-2 mt-1 p-1 hover:bg-gray-200 rounded"
                      title={isSelected ? "Deselect" : "Select"}
                    >
                      {isSelected ? (
                        <CheckCircle size={16} className="text-blue-600" />
                      ) : (
                        <Square size={16} className="text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => onEmailSelect(email.uid)}
                      className="flex-1 text-left"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3 items-start">
                        <div className="min-w-0">
                          <div className="flex items-start mb-1 gap-2">
                            {!isRead && (
                              <div className="w-2.5 h-2.5 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
                            )}
                            <span className={`text-sm truncate pr-2 ${isRead ? 'text-gray-600' : 'font-bold text-gray-900'}`}>
                              {email.from}
                            </span>
                          </div>
                          <div className={`text-sm truncate ${isRead ? 'text-gray-700' : 'font-bold text-gray-900'}`}>
                            {email.subject}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-1">
                            {email.preview || 'No content'}
                          </div>
                          {appliedLabels.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {appliedLabels.map((label) => {
                                const labelDef = labelOptions.find(option => option.name === label);
                                const chipStyle = labelDef
                                  ? {
                                      backgroundColor: `${labelDef.colorHex}1A`,
                                      borderColor: `${labelDef.colorHex}33`,
                                      color: labelDef.textHex,
                                    }
                                  : undefined;
                                return (
                                  <span
                                    key={label}
                                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                                    style={chipStyle}
                                  >
                                    {label}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <div className="text-xs text-gray-600 whitespace-nowrap font-medium">
                            {formatTimestamp(email.date)}
                          </div>
                          <div className="flex items-center -space-x-0.5">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleStar(email.uid, isStarred);
                              }}
                              className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-yellow-500 transition-colors"
                              title={isStarred ? 'Ta bort stjarna' : 'Stjarnmark'}
                            >
                              <Star
                                size={14}
                                className={isStarred ? 'text-yellow-500' : 'text-gray-400'}
                                fill={isStarred ? 'currentColor' : 'none'}
                              />
                            </button>
                            <div className="relative" data-label-menu>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setLabelMenuUid(prev => (prev === email.uid ? null : email.uid));
                                }}
                                className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                                title="Etiketter"
                              >
                                <Tag size={14} />
                              </button>
                              {labelMenuUid === email.uid && (
                                <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-20">
                                  <div className="text-[10px] uppercase text-gray-400 px-1 pb-1">Etiketter</div>
                                  <div className="space-y-1">
                                    {labelOptions.length === 0 && (
                                      <div className="px-2 py-1 text-xs text-gray-400">Inga etiketter</div>
                                    )}
                                    {labelOptions.map((label) => {
                                      const isApplied = appliedLabels.includes(label.name);
                                      return (
                                        <button
                                          key={label.name}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            onToggleLabel(email.uid, label.name, isApplied);
                                          }}
                                          className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-50"
                                        >
                                          <span className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.colorHex }} />
                                            <span className="text-xs text-gray-700">{label.name}</span>
                                          </span>
                                          {isApplied && <CheckCircle size={14} className="text-blue-500" />}
                                        </button>
                                      );
                                    })}
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setLabelMenuUid(null);
                                        onOpenLabelManager();
                                      }}
                                      className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs text-gray-500 hover:bg-gray-50"
                                    >
                                      Hantera etiketter
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!isRead) return;
                                onToggleRead(email.uid, isRead);
                              }}
                              className={`h-6 w-6 flex items-center justify-center transition-colors ${isRead ? 'text-gray-400 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                              title="Gör oläst"
                              aria-disabled={!isRead}
                            >
                              <Mail size={14} />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (allowPermanentDelete) return;
                                onDeleteEmail(email.uid);
                              }}
                              className={`h-6 w-6 flex items-center justify-center transition-colors ${
                                allowPermanentDelete ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-amber-600'
                              }`}
                              title={allowPermanentDelete ? 'Redan i papperskorgen' : 'Flytta till papperskorgen'}
                              aria-disabled={allowPermanentDelete}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!allowPermanentDelete) return;
                                onPermanentDeleteEmail(email.uid);
                              }}
                              className={`h-6 w-6 flex items-center justify-center transition-colors ${
                                allowPermanentDelete ? 'text-gray-400 hover:text-red-500' : 'text-gray-300 cursor-not-allowed'
                              }`}
                              title={allowPermanentDelete ? 'Radera permanent' : 'Endast i papperskorgen'}
                              aria-disabled={!allowPermanentDelete}
                            >
                              <CircleX size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
