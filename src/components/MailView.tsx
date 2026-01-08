'use client';

import { useState } from 'react';
import { Reply, ReplyAll, Forward, Trash2, MoreHorizontal, FolderInput, User, ChevronDown, ChevronUp } from 'lucide-react';

interface MailViewProps {
  email: any | null;
  isLoading: boolean;
  onReply?: (email: any) => void;
  onReplyAll?: (email: any) => void;
  onForward?: (email: any) => void;
  onDelete?: (email: any) => void;
  onMoveToFolder?: (email: any) => void;
  onComposeTo?: (address: string) => void;
}

interface Recipient {
  name: string;
  address: string;
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
  onComposeTo = () => {}
}: MailViewProps) {
  const [showAllRecipients, setShowAllRecipients] = useState(false);

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

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => onReply(email)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            title="Reply"
          >
            <Reply size={20} />
          </button>
          <button
            onClick={() => onReplyAll(email)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            title="Reply All"
          >
            <ReplyAll size={20} />
          </button>
          <button
            onClick={() => onForward(email)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            title="Forward"
          >
            <Forward size={20} />
          </button>
          <button
            onClick={() => onDelete(email)}
            className="p-2 hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={() => onMoveToFolder(email)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            title="Move to Folder"
          >
            <FolderInput size={20} />
          </button>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
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
                <span className="text-sm text-gray-500 whitespace-nowrap">{new Date(email.date).toLocaleString()}</span>
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

        <div className="prose max-w-none text-gray-800 leading-relaxed">
          {/* In a real app we'd handle HTML/Sanitization */}
          <div
            className="email-content"
            dangerouslySetInnerHTML={{ __html: email.body || 'No content' }}
          />
        </div>
      </div>
    </div>
  );
}
