'use client';

import {
  Settings, Plus,
  Inbox, Send, File, Archive, Trash2, AlertCircle,
  ChevronDown, ChevronRight, ChevronLeft, User, FileSignature, LogOut, CalendarDays
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';
import { useState } from 'react';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export interface Account {
  id: string;
  email: string;
  name?: string;
  senderName?: string;
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
  onOpenCalendar?: () => void;
  onLogout?: () => void;
  currentUserName?: string;
  storageUsage?: {
    usedBytes: number;
    quotaMb: number | null;
  };
}

export default function Sidebar({ accounts, activeAccountId, activeFolder, onSelect, onAddAccount, onSettings, onEditSignature, onOpenCalendar, onLogout, currentUserName, storageUsage }: SidebarProps) {
  // Track expanded state for accounts (default all expanded)
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>(
    accounts.reduce((acc, curr) => ({ ...acc, [curr.id]: true }), {})
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const usedMb = storageUsage ? storageUsage.usedBytes / (1024 * 1024) : 0;
  const quotaMb = storageUsage?.quotaMb ?? null;
  const usagePercent = quotaMb && quotaMb > 0 ? Math.min(100, (usedMb / quotaMb) * 100) : 0;
  const usageLabel = quotaMb && quotaMb > 0
    ? `${usedMb.toFixed(1)} MB / ${quotaMb} MB`
    : `${usedMb.toFixed(1)} MB`;

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-gray-50 border-r border-gray-200 text-gray-900 flex-shrink-0 transition-all duration-300 relative",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header / Logo */}
      <div className={cn(
        "flex items-center justify-center border-b border-gray-100 bg-white h-14 transition-all relative overflow-hidden",
        isCollapsed ? "px-2" : "px-4"
      )}>
        <div className="relative w-full h-10 flex items-center justify-center">
          {/* Large Logo */}
          <div className={cn(
            "absolute transition-all duration-500 ease-in-out transform",
            isCollapsed ? "opacity-0 scale-90 -translate-y-8 pointer-events-none" : "opacity-100 scale-100 translate-y-0"
          )}>
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={160} 
              height={40} 
              className="object-contain w-auto h-auto max-h-10"
              priority
            />
          </div>

          {/* Mini Logo */}
          <div className={cn(
            "absolute transition-all duration-500 ease-in-out transform",
            isCollapsed ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8 pointer-events-none"
          )}>
            <Image
              src="/uxmail_mini_final.png"
              alt="Mini Logo"
              width={40}
              height={40}
              className="object-contain w-auto h-10 rounded-xl shadow-sm"
              priority
            />
          </div>
        </div>
        <button
          onClick={() => setIsCollapsed(prev => !prev)}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 flex items-center justify-center transition-colors",
            isCollapsed && "right-1"
          )}
          title={isCollapsed ? "Fäll ut menyn" : "Fäll ihop menyn"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Account List (Tree) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-gray-200">
        {accounts.map((account) => {
          const isExpanded = expandedAccounts[account.id] ?? true;
          const isActiveAccount = activeAccountId === account.id;

          return (
            <div key={account.id} className="select-none relative">
              {/* Account Header */}
              <button
                onClick={() => toggleAccount(account.id)}
                className={cn(
                  "w-full flex items-center gap-2 py-1.5 hover:bg-gray-200/50 rounded-lg transition-colors text-left group pl-2",
                  isCollapsed ? "justify-start px-2" : "px-2"
                )}
                title={account.email}
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-200 flex-shrink-0">
                  {account.name?.[0] || account.email[0]}
                </div>
                {!isCollapsed && (
                  <span className="text-sm font-semibold text-gray-700 truncate flex-1">
                    {account.name || account.email.split('@')[0]}
                  </span>
                )}
                {!isCollapsed && (
                  <span className="text-gray-400 group-hover:text-gray-600 ml-auto">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                )}
              </button>

              {/* Account Folders */}
              {isExpanded && (
                <div className={cn(
                  "mt-1 space-y-0.5 relative",
                  !isCollapsed && "ml-0 pl-0"
                )}>
                  {folders.map((folder) => {
                    const isActive = isActiveAccount && activeFolder === folder.id;
                    const Icon = folder.icon;
                    const isBranch = folder.id === 'Important';

                    return (
                      <div key={folder.id} className="relative">
                        {isBranch && !isCollapsed && (
                           <div className="absolute left-2 top-0 bottom-1/2 w-3 border-l-2 border-b-2 border-gray-200 rounded-bl-lg" style={{ top: '-10px' }} />
                        )}
                        <button
                          onClick={() => onSelect(account.id, folder.id)}
                          title={isCollapsed ? folder.name : undefined}
                          className={cn(
                            "w-full flex items-center gap-2.5 py-1.5 rounded-md text-[12px] transition-all duration-200",
                            isBranch && !isCollapsed ? "ml-4 w-[calc(100%-1rem)]" : "",
                            isActive
                              ? "bg-blue-100 text-blue-700 font-medium"
                              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                            isCollapsed ? "justify-start px-2" : "px-3"
                          )}
                        >
                          <Icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                          {!isCollapsed && <span>{folder.name}</span>}
                        </button>

                        {/* Signature button appears only under Trash folder */}
                        {folder.id === 'Trash' && (
                          <>
                            {!isCollapsed && <div className="border-t border-gray-200 my-1"></div>}
                            <button
                              onClick={() => onEditSignature(account.id, account.signature || '')}
                              title={isCollapsed ? "Signatur" : undefined}
                            className={cn(
                              "w-full flex items-center gap-2.5 py-1.5 rounded-md text-sm transition-all duration-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                              isCollapsed ? "justify-start px-2 mt-1" : "px-3"
                            )}
                          >
                              <FileSignature size={16} className="text-gray-400" />
                              {!isCollapsed && <span>Signatur</span>}
                            </button>
                            <button
                              onClick={() => alert('Adressbok för detta konto kommer snart!')}
                              title={isCollapsed ? "Adressbok" : undefined}
                            className={cn(
                              "w-full flex items-center gap-2.5 py-1.5 rounded-md text-sm transition-all duration-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                              isCollapsed ? "justify-start px-2" : "px-3"
                            )}
                          >
                              <User size={16} className="text-gray-400" />
                              {!isCollapsed && <span>Adressbok</span>}
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
          title={isCollapsed ? "Add Account" : undefined}
          className={cn(
            "w-full flex items-center gap-3 py-2 mt-4 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-dashed border-gray-300 transition-colors",
            isCollapsed ? "justify-center px-0" : "px-4"
          )}
        >
          <Plus size={16} />
          {!isCollapsed && <span>Add Account</span>}
        </button>
      </div>

      {/* Footer / Settings */}
      <div className="p-3 border-t border-gray-200 bg-white space-y-2">
        {currentUserName && (
          <div
            className={cn(
              "w-full flex items-center gap-2 py-2 text-sm text-gray-600 rounded-lg",
              isCollapsed ? "justify-center px-0" : "px-3"
            )}
            title={isCollapsed ? currentUserName : undefined}
          >
            <User size={18} />
            {!isCollapsed && <span>Inloggad som {currentUserName}</span>}
          </div>
        )}
        {storageUsage && (
          <div className={cn(
            "rounded-md border border-gray-200 bg-white/80 p-1.5 text-[11px] text-gray-600",
            isCollapsed ? "mx-0" : "mx-1"
          )}>
            {!isCollapsed && <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Lagring (alla konton)</div>}
            {!isCollapsed && <div className="mt-0.5 text-[12px] font-semibold text-gray-800">{usageLabel}</div>}
            <div className={cn("mt-1 h-1 w-full rounded-full bg-gray-200", isCollapsed && "hidden")} role="progressbar">
              <div
                className="h-1 rounded-full bg-blue-500 transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {isCollapsed && (
              <div className="flex justify-center">
                <div className="h-6 w-6 rounded-full border border-gray-200 bg-white flex items-center justify-center text-[8px] font-semibold text-gray-600">
                  {Math.round(usagePercent)}%
                </div>
              </div>
            )}
          </div>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            title={isCollapsed ? "Logga ut" : undefined}
            className={cn(
              "w-full flex items-center gap-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors",
              isCollapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <LogOut size={18} />
            {!isCollapsed && <span>Logga ut</span>}
          </button>
        )}
        {onOpenCalendar && (
          <button
            onClick={onOpenCalendar}
            title={isCollapsed ? "Kalender" : undefined}
            className={cn(
              "w-full flex items-center gap-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors",
              isCollapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <CalendarDays size={18} />
            {!isCollapsed && <span>Kalender</span>}
          </button>
        )}
        <button
          onClick={onSettings}
          title={isCollapsed ? "Settings" : undefined}
          className={cn(
            "w-full flex items-center gap-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors",
            isCollapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <Settings size={18} />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </div>
    </div>
  );
}
