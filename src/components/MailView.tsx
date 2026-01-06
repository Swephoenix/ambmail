'use client';

import { Reply, ReplyAll, Forward, Trash2, MoreHorizontal, FolderInput, User } from 'lucide-react';

interface MailViewProps {
  email: any | null;
  isLoading: boolean;
  onReply?: (email: any) => void;
  onReplyAll?: (email: any) => void;
  onForward?: (email: any) => void;
  onDelete?: (email: any) => void;
  onMoveToFolder?: (email: any) => void;
}

export default function MailView({
  email,
  isLoading,
  onReply = () => {},
  onReplyAll = () => {},
  onForward = () => {},
  onDelete = () => {},
  onMoveToFolder = () => {}
}: MailViewProps) {
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

        <div className="flex items-center mb-8">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold mr-4">
            {email.from[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-900">{email.from}</span>
              <span className="text-sm text-gray-500">{new Date(email.date).toLocaleString()}</span>
            </div>
            {email.to && <div className="text-sm text-gray-500">to: {email.to}</div>}
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
