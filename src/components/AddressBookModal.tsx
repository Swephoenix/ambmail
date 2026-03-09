'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Upload, Plus, Trash2, Users, User, Check, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  groups: { group: { id: string; name: string } }[];
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isGlobal?: boolean;
  contactCount: number;
}

interface AddressBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddressBookModal({ isOpen, onClose }: AddressBookModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all-active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGroup) params.set('groupId', selectedGroup);
      if (searchQuery) params.set('q', searchQuery);
      
      const res = await fetch(`/api/contacts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      toast.error('Kunde inte ladda kontakter');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      fetchContacts();
    }
  }, [isOpen, fetchGroups, fetchContacts]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Gruppnamn krävs');
      return;
    }

    try {
      const res = await fetch('/api/contacts/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
        }),
      });

      if (res.ok) {
        toast.success('Grupp skapad');
        setNewGroupName('');
        setNewGroupDescription('');
        setIsCreatingGroup(false);
        fetchGroups();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Kunde inte skapa grupp');
      }
    } catch (error) {
      toast.error('Kunde inte skapa grupp');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || group.isSystem) return;

    if (!confirm(`Är du säker på att du vill ta bort gruppen "${group.name}"?`)) return;

    try {
      const res = await fetch(`/api/contacts/groups?id=${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Grupp borttagen');
        if (selectedGroup === groupId) setSelectedGroup('all-active');
        fetchGroups();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Kunde inte ta bort grupp');
      }
    } catch (error) {
      toast.error('Kunde inte ta bort grupp');
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedGroup) params.set('groupId', selectedGroup);
      
      const res = await fetch(`/api/contacts/csv?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kontakter.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Kontakter exporterade');
      }
    } catch (error) {
      toast.error('Kunde inte exportera kontakter');
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await fetch('/api/contacts/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Importerade ${data.imported} kontakter${data.failed ? `, ${data.failed} misslyckades` : ''}`);
        fetchContacts();
        fetchGroups();
      } else {
        toast.error(data.error || 'Kunde inte importera');
      }
    } catch (error) {
      toast.error('Kunde inte importera filen');
    }
    
    event.target.value = '';
  };

  const handleAddContact = async () => {
    const email = prompt('E-postadress:');
    if (!email) return;
    
    const name = prompt('Namn (valfritt):') || undefined;

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, isActive: true }),
      });

      if (res.ok) {
        toast.success('Kontakt tillagd');
        fetchContacts();
        fetchGroups();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Kunde inte lägga till kontakt');
      }
    } catch (error) {
      toast.error('Kunde inte lägga till kontakt');
    }
  };

  const handleDeleteContact = async (email: string) => {
    if (!confirm('Ta bort denna kontakt?')) return;

    try {
      const res = await fetch(`/api/contacts?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Kontakt borttagen');
        fetchContacts();
        fetchGroups();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Kunde inte ta bort kontakt');
      }
    } catch (error) {
      toast.error('Kunde inte ta bort kontakt');
    }
  };

  const handleToggleContactSelection = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleAssignToGroup = async (contactEmail: string, groupId: string) => {
    try {
      const res = await fetch('/api/contacts/groups/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, contactEmail }),
      });

      if (res.ok) {
        toast.success('Kontakt tillagd i grupp');
        fetchContacts();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Kunde inte lägga till i grupp');
      }
    } catch (error) {
      toast.error('Kunde inte lägga till i grupp');
    }
  };

  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      contact.email.toLowerCase().includes(q) ||
      (contact.name && contact.name.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Adressbok</h2>
            <p className="text-sm text-gray-500 mt-1">Hantera dina kontakter och grupper</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Groups */}
          <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Grupper</h3>
                <button
                  onClick={() => setIsCreatingGroup(true)}
                  className="text-blue-600 hover:text-blue-700 p-1 hover:bg-blue-50 rounded transition-colors"
                  title="Skapa grupp"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Global System Groups */}
              {groups.filter(g => g.isGlobal).map(group => (
                <div
                  key={group.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedGroup === group.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => setSelectedGroup(group.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Users size={16} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{group.name}</div>
                      <div className="text-xs text-gray-500">{group.contactCount} kontakter</div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Divider */}
              {groups.some(g => g.isGlobal) && groups.some(g => !g.isGlobal) && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-t border-gray-200 mt-2">
                  Mina grupper
                </div>
              )}

              {/* User's Personal Groups */}
              {groups.filter(g => !g.isGlobal).map(group => (
                <div
                  key={group.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedGroup === group.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => setSelectedGroup(group.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Users size={16} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{group.name}</div>
                      <div className="text-xs text-gray-500">{group.contactCount} kontakter</div>
                    </div>
                  </div>
                  {!group.isSystem && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id);
                      }}
                      className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Import/Export */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowImportExport(!showImportExport)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {showImportExport ? <X size={16} /> : <Upload size={16} />}
                {showImportExport ? 'Stäng' : 'Importera/Exportera'}
              </button>
              
              {showImportExport && (
                <div className="mt-2 space-y-2">
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Download size={16} />
                    Exportera CSV
                  </button>
                  <label className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer">
                    <Upload size={16} />
                    Importera CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportCSV}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Contacts */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Sök kontakter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <button
                onClick={handleAddContact}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus size={18} />
                Ny kontakt
              </button>
            </div>

            {/* Create Group Form */}
            {isCreatingGroup && (
              <div className="p-4 border-b border-gray-200 bg-blue-50 flex-shrink-0">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      placeholder="Gruppnamn"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="Beskrivning (valfritt)"
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateGroup}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Skapa
                    </button>
                    <button
                      onClick={() => {
                        setIsCreatingGroup(false);
                        setNewGroupName('');
                        setNewGroupDescription('');
                      }}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Laddar kontakter...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <User size={48} className="mx-auto mb-3 text-gray-300" />
                    <p>Inga kontakter hittades</p>
                  </div>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
                            } else {
                              setSelectedContacts(new Set());
                            }
                          }}
                          checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-post</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupper</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Åtgärder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredContacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(contact.id)}
                            onChange={() => handleToggleContactSelection(contact.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{contact.name || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600">{contact.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {contact.groups.slice(0, 3).map(({ group }) => (
                              <span
                                key={group.id}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                              >
                                {group.name}
                              </span>
                            ))}
                            {contact.groups.length > 3 && (
                              <span className="text-xs text-gray-500">+{contact.groups.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            contact.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {contact.isActive ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignToGroup(contact.email, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              defaultValue=""
                              className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                              <option value="">Lägg till i...</option>
                              {groups.filter(g => !g.isSystem && !g.isGlobal).map(group => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleDeleteContact(contact.email)}
                              className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center flex-shrink-0">
          <div className="text-sm text-gray-600">
            {filteredContacts.length} kontakt{filteredContacts.length !== 1 ? 'er' : ''} visade
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}
