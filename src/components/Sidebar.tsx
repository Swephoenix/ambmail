'use client';

import {
  Settings, Plus, Check,
  Inbox, Send, File, Archive, Trash2, AlertCircle,
  ChevronDown, ChevronRight, User, Star, FileSignature
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';
import { useState } from 'react';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export interface Account {
  id: string;
  email: string;
  name?: string;
  signature?: string;
}

interface SidebarProps {
  accounts: Account[];
  activeAccountId: string | null;
  activeFolder: string;
  onSelect: (accountId: string, folder: string) => void;
  onAddAccount: () => void;
  onSettings: () => void;
  onEditSignature: (accountId: string, currentSignature: string) => void;
}

export default function Sidebar({ accounts, activeAccountId, activeFolder, onSelect, onAddAccount, onSettings, onEditSignature }: SidebarProps) {
  // Track expanded state for accounts (default all expanded)
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>(
    accounts.reduce((acc, curr) => ({ ...acc, [curr.id]: true }), {})
  );

  const toggleAccount = (id: string) => {
    setExpandedAccounts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const folders = [
    { id: 'INBOX', name: 'Inbox', icon: Inbox },
    { id: 'Sent', name: 'Skickat', icon: Send },
    { id: 'Drafts', name: 'Utkast', icon: File },
    { id: 'Archive', name: 'Arkiv', icon: Archive },
    { id: 'spam', name: 'Skräppost', icon: AlertCircle },
    { id: 'Trash', name: 'Papperskorg', icon: Trash2 },
  ];

  return (
    <div className="w-64 flex flex-col h-full bg-gray-50 border-r border-gray-200 text-gray-900 flex-shrink-0">
      
      {/* Header / Logo */}
      <div className="p-4 flex items-center justify-center border-b border-gray-100 bg-white min-h-[73px]">
        <Image 
          src="/logo.png" 
          alt="Logo" 
          width={160} 
          height={40} 
          className="object-contain w-full h-auto max-h-12"
        />
      </div>

      {/* Account List (Tree) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {accounts.map((account) => {
          const isExpanded = expandedAccounts[account.id] ?? true;
          const isActiveAccount = activeAccountId === account.id;

          return (
            <div key={account.id} className="select-none">
              {/* Account Header */}
              <button
                onClick={() => toggleAccount(account.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-200/50 rounded-lg transition-colors text-left group"
              >
                <span className="text-gray-400 group-hover:text-gray-600">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-200">
                  {account.name?.[0] || account.email[0]}
                </div>
                <span className="text-sm font-semibold text-gray-700 truncate flex-1">
                  {account.name || account.email.split('@')[0]}
                </span>
              </button>

              {/* Account Folders */}
              {isExpanded && (
                <div className="mt-1 ml-6 pl-2 border-l border-gray-200 space-y-0.5">
                  {folders.map((folder) => {
                    const isActive = isActiveAccount && activeFolder === folder.id;
                    const Icon = folder.icon;
                    const isBranch = folder.id === 'Important';

                    return (
                      <div key={folder.id} className="relative">
                        {isBranch && (
                           <div className="absolute left-2 top-0 bottom-1/2 w-3 border-l-2 border-b-2 border-gray-200 rounded-bl-lg" style={{ top: '-10px' }} />
                        )}
                        <button
                          onClick={() => onSelect(account.id, folder.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-all duration-200",
                            isBranch ? "ml-4 w-[calc(100%-1rem)]" : "",
                            isActive
                              ? "bg-blue-100 text-blue-700 font-medium"
                              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                          )}
                        >
                          <Icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                          <span>{folder.name}</span>
                        </button>

                        {/* Signature button appears only under Trash folder */}
                        {folder.id === 'Trash' && (
                          <>
                            <div className="border-t border-gray-200 my-1"></div>
                            <button
                              onClick={() => onEditSignature(account.id, account.signature || '')}
                              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-all duration-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            >
                              <FileSignature size={16} className="text-gray-400" />
                              <span>Signatur</span>
                            </button>
                            <button
                              onClick={() => alert('Adressbok för detta konto kommer snart!')}
                              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-all duration-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            >
                              <User size={16} className="text-gray-400" />
                              <span>Adressbok</span>
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Account Button */}
        <button
          onClick={onAddAccount}
          className="w-full flex items-center gap-3 px-4 py-2 mt-4 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-dashed border-gray-300 transition-colors"
        >
          <Plus size={16} />
          <span>Add Account</span>
        </button>
      </div>

      {/* Footer / Settings */}
      <div className="p-3 border-t border-gray-200 bg-white space-y-2">
        <button
          onClick={() => alert('Global adressbok kommer snart!')}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <User size={18} />
          <span>Global adressbok</span>
        </button>
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <User size={18} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}