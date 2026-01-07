'use client';

import { format } from 'date-fns';
import { RefreshCcw, Search, Trash2, FolderPlus, Move, CheckCircle, Square } from 'lucide-react';

export interface EmailHeader {
  uid: number;
  subject: string;
  from: string;
  to?: string;
  date: string;
  flags: string[];
  preview?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

interface MailListProps {
  emails: EmailHeader[];
  selectedEmailUid: number | null;
  onEmailSelect: (uid: number) => void;
  onToggleRead: (uid: number, isRead: boolean) => void;
  isLoading: boolean;
  onRefresh: () => void;
  folderName: string;
  // New props for multi-select functionality
  selectedEmails?: number[];
  onEmailSelectToggle?: (uid: number) => void;
  onSelectAll?: () => void;
  onDeleteSelected?: () => void;
  onMoveSelected?: (targetFolder: string) => void;
}

export default function MailList({
  emails,
  selectedEmailUid,
  onEmailSelect,
  onToggleRead,
  isLoading,
  onRefresh,
  folderName,
  selectedEmails = [],
  onEmailSelectToggle = () => {},
  onSelectAll = () => {},
  onDeleteSelected = () => {},
  onMoveSelected = () => {}
}: MailListProps) {
  const isAllSelected = emails.length > 0 && emails.every(email => selectedEmails.includes(email.uid));

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
                onClick={onDeleteSelected}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Delete selected"
              >
                <Trash2 size={18} className="text-red-500" />
              </button>
              <button
                onClick={() => onMoveSelected('')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Move selected"
              >
                <Move size={18} className="text-gray-500" />
              </button>
            </>
          ) : (
            <button
              onClick={onRefresh}
              className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${isLoading ? 'animate-spin' : ''}`}
            >
              <RefreshCcw size={18} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search mail..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
              <div className="px-4 py-2 border-b border-gray-100 flex items-center">
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
              </div>
            )}
            {emails.map((email) => {
              const isRead = email.flags.includes('\\Seen');
              const isSelected = selectedEmails.includes(email.uid);
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
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {!isRead && (
                            <div className="w-2.5 h-2.5 bg-blue-600 rounded-full flex-shrink-0" />
                          )}
                          <span className={`text-sm truncate pr-2 ${isRead ? 'text-gray-600' : 'font-bold text-gray-900'}`}>
                            {email.from}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {format(new Date(email.date), 'MMM d')}
                        </span>
                      </div>
                      <div className={`text-sm truncate ${isRead ? 'text-gray-700' : 'font-bold text-gray-900'}`}>
                        {email.subject}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {email.preview || 'No content'}
                      </div>
                    </button>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRead(email.uid, isRead);
                    }}
                    className="absolute right-4 bottom-4 p-1.5 bg-white border border-gray-200 rounded-md shadow-sm opacity-0 group-hover:opacity-100 hover:bg-gray-50 transition-all z-10"
                  >
                    <div className={`w-3 h-3 rounded-full border-2 ${isRead ? 'border-blue-600' : 'bg-blue-600 border-blue-600'}`} />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
