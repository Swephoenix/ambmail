/* eslint-disable @typescript-eslint/no-explicit-any */
import imaps from 'imap-simple';
import type { ImapSimple, ImapSimpleOptions } from 'imap-simple';
import { simpleParser } from 'mailparser';
import { decrypt } from './encryption';

const nodemailer = require('nodemailer') as {
  createTransport: (options: any) => any;
};

export interface MailAccount {
  id: string;
  email: string;
  password?: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  signature?: string | null;
  name?: string | null;
}

function resolvePassword(encrypted: string): string {
  const decrypted = decrypt(encrypted);
  if (decrypted) return decrypted;

  const looksEncrypted = encrypted.startsWith('U2FsdGVk');
  if (!looksEncrypted && encrypted.length > 0) {
    return encrypted;
  }

  throw new Error('Account password is missing or could not be decrypted. Re-enter the password.');
}

export async function getImapConnection(account: MailAccount): Promise<ImapSimple> {
  if (!account.password) throw new Error('Password required');
  const password = resolvePassword(account.password);
  const useImplicitTls = account.imapPort === 993;
  const config: ImapSimpleOptions = {
    imap: {
      user: account.email,
      password,
      host: account.imapHost,
      port: account.imapPort,
      tls: useImplicitTls,
      autotls: useImplicitTls ? 'never' : 'always',
      authTimeout: 3000,
      tlsOptions: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    },
  };

  return imaps.connect(config);
}

export async function getSmtpTransporter(account: MailAccount) {
  if (!account.password) throw new Error('Password required');
  const password = resolvePassword(account.password);

  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465, // true for 465, false for other ports
    requireTLS: true,
    auth: {
      user: account.email,
      pass: password, // Changed from 'password' to 'pass'
    },
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    }
  } as any); // Use any to bypass strict type checking for this simple implementation
}

export async function openMailbox(connection: ImapSimple, folder: string) {
  try {
    await connection.openBox(folder);
  } catch (error: unknown) {
    // Some servers require INBOX. prefix for custom folders
    if (!folder.toUpperCase().startsWith('INBOX')) {
      try {
        await connection.openBox(`INBOX.${folder}`);
      } catch {
        // If it still fails, try lowercase or other common variants if necessary
        // For now, throw the original error
        throw error;
      }
    } else {
      throw error;
    }
  }
}

export async function getDraftsFolder(connection: ImapSimple) {
  // Try to find a folder with the \Drafts attribute
  const boxes = await connection.getBoxes();
  
  const findDraftsRecursive = (boxList: any, parentKey = ''): string | null => {
    for (const key of Object.keys(boxList)) {
      const box = boxList[key];
      const fullPath = parentKey ? `${parentKey}${box.delimiter}${key}` : key;
      if (box.attribs.some((a: string) => a.toLowerCase() === '\\drafts')) {
        return fullPath;
      }
      if (box.children) {
        const childResult = findDraftsRecursive(box.children, fullPath);
        if (childResult) return childResult;
      }
    }
    return null;
  };

  const draftsFolder = findDraftsRecursive(boxes);
  if (draftsFolder) return draftsFolder;

  // Fallback common names
  return 'INBOX.Drafts'; // Default fallback for this specific user case
}

export async function appendDraft(connection: ImapSimple, rawEmail: string) {
  const draftsFolder = await getDraftsFolder(connection);
  // Ensure folder exists or handle error (usually it exists)
  return connection.append(rawEmail, { mailbox: draftsFolder, flags: ['\Draft'] });
}

export async function getSentFolder(connection: ImapSimple) {
  const boxes = await connection.getBoxes();

  const findSentRecursive = (boxList: any, parentKey = ''): string | null => {
    for (const key of Object.keys(boxList)) {
      const box = boxList[key];
      const fullPath = parentKey ? `${parentKey}${box.delimiter}${key}` : key;
      if (box.attribs.some((a: string) => a.toLowerCase() === '\\sent')) {
        return fullPath;
      }
      if (box.children) {
        const childResult = findSentRecursive(box.children, fullPath);
        if (childResult) return childResult;
      }
    }
    return null;
  };

  const sentFolder = findSentRecursive(boxes);
  if (sentFolder) return sentFolder;

  return 'INBOX.Sent';
}

export async function appendSent(connection: ImapSimple, rawEmail: string) {
  const sentFolder = await getSentFolder(connection);
  await connection.append(rawEmail, { mailbox: sentFolder, flags: ['\\Seen'] });
  return sentFolder;
}

function extractFolderPaths(boxList: any, parentKey = ''): string[] {
  const folders: string[] = [];
  for (const key of Object.keys(boxList || {})) {
    const box = boxList[key];
    const fullPath = parentKey ? `${parentKey}${box.delimiter}${key}` : key;
    folders.push(fullPath);
    if (box.children) {
      folders.push(...extractFolderPaths(box.children, fullPath));
    }
  }
  return folders;
}

export async function getTrashFolder(connection: ImapSimple) {
  const boxes = await connection.getBoxes();

  const findTrashRecursive = (boxList: any, parentKey = ''): string | null => {
    for (const key of Object.keys(boxList)) {
      const box = boxList[key];
      const fullPath = parentKey ? `${parentKey}${box.delimiter}${key}` : key;
      if ((box.attribs || []).some((a: string) => a.toLowerCase() === '\\trash')) {
        return fullPath;
      }
      if (box.children) {
        const childResult = findTrashRecursive(box.children, fullPath);
        if (childResult) return childResult;
      }
    }
    return null;
  };

  const trashFolder = findTrashRecursive(boxes);
  if (trashFolder) return trashFolder;

  const fallbacks = [
    'INBOX.Trash',
    'Trash',
    'INBOX.Deleted',
    'Deleted Items',
    'INBOX.Deleted Items',
    'INBOX.Papperskorg',
    'Papperskorg',
  ];
  const available = extractFolderPaths(boxes).map((folder) => folder.toLowerCase());
  const fallbackMatch = fallbacks.find((name) => available.includes(name.toLowerCase()));
  if (fallbackMatch) return fallbackMatch;

  return 'INBOX.Trash';
}

const SENT_ALIASES = new Set(['sent', 'skickat']);
const DRAFT_ALIASES = new Set(['drafts', 'utkast']);
const TRASH_ALIASES = new Set(['trash', 'papperskorg']);

export function isFolderAlias(folder: string) {
  const normalized = folder.trim().toLowerCase();
  return SENT_ALIASES.has(normalized) || DRAFT_ALIASES.has(normalized) || TRASH_ALIASES.has(normalized);
}

export async function resolveFolderAlias(connection: ImapSimple, folder: string) {
  const normalized = folder.trim().toLowerCase();
  if (SENT_ALIASES.has(normalized)) {
    return getSentFolder(connection);
  }
  if (DRAFT_ALIASES.has(normalized)) {
    return getDraftsFolder(connection);
  }
  if (TRASH_ALIASES.has(normalized)) {
    return getTrashFolder(connection);
  }
  return folder;
}

export async function fetchEmails(connection: ImapSimple, folder = 'INBOX', limit = 20) {
  await openMailbox(connection, folder);

  const searchCriteria = ['ALL'];
  const fetchOptions = {
    bodies: ['HEADER', ''], // Fetch both header and body
    struct: true,
    markSeen: false
  };

  const messages = await connection.search(searchCriteria, fetchOptions);

  // Sort by sequence number descending and take limit
  const recentMessages = messages.sort((a, b) => b.attributes.uid - a.attributes.uid).slice(0, limit);

  return Promise.all(recentMessages.map(async (item) => {
    const headerPart = item.parts.find(part => part.which === 'HEADER');
    const bodyPart = item.parts.find(part => part.which === '');

    let subject = 'No Subject';
    let from = 'Unknown';
    let to = '';
    let cc = '';
    let messageId = '';
    let inReplyTo = '';
    let references = '';
    let preview = 'No content';
    let dateValue: string | Date | null = item.attributes?.date ?? null;

    // Use the header part to extract information as the primary method
    if (headerPart?.body) {
      try {
        // Extract headers from the raw header data
        const headerBody = headerPart.body;

        // Check if headerBody is an object with header fields or a string
        let headerText = '';
        if (typeof headerBody === 'string') {
          headerText = headerBody;
        } else if (typeof headerBody === 'object' && headerBody !== null) {
          // If headerBody is an object, it might contain the headers directly
          // imap-simple can return headers as an object with arrays of values
          console.log('Header body is an object with keys:', Object.keys(headerBody));

          // Try to extract the headers from the object
          const headerObj: any = headerBody;

          // Extract subject
          if (headerObj.subject && Array.isArray(headerObj.subject) && headerObj.subject.length > 0) {
            subject = headerObj.subject[0] || 'No Subject';
          } else if (headerObj.subject && typeof headerObj.subject === 'string') {
            subject = headerObj.subject || 'No Subject';
          } else {
            subject = 'No Subject';
          }

          // Extract from
          if (headerObj.from && Array.isArray(headerObj.from) && headerObj.from.length > 0) {
            // Handle from as an array of address objects
            const fromAddr = headerObj.from[0];
            if (typeof fromAddr === 'object' && fromAddr !== null) {
              from = fromAddr.name ? `${fromAddr.name} <${fromAddr.address}>` : fromAddr.address || 'Unknown';
            } else {
              from = fromAddr || 'Unknown';
            }
          } else if (headerObj.from && typeof headerObj.from === 'string') {
            from = headerObj.from || 'Unknown';
          } else {
            from = 'Unknown';
          }

          // Extract other headers
          to = (headerObj.to && Array.isArray(headerObj.to) && headerObj.to.length > 0) ? headerObj.to[0] : '';
          cc = (headerObj.cc && Array.isArray(headerObj.cc) && headerObj.cc.length > 0) ? headerObj.cc[0] : '';
          messageId = (headerObj['message-id'] && Array.isArray(headerObj['message-id']) && headerObj['message-id'].length > 0) ? headerObj['message-id'][0] : '';
          inReplyTo = (headerObj['in-reply-to'] && Array.isArray(headerObj['in-reply-to']) && headerObj['in-reply-to'].length > 0) ? headerObj['in-reply-to'][0] : '';
          references = (headerObj.references && Array.isArray(headerObj.references) && headerObj.references.length > 0) ? headerObj.references[0] : '';
          if (!dateValue && headerObj.date) {
            dateValue = Array.isArray(headerObj.date) ? headerObj.date[0] : headerObj.date;
          }

          // Clean up the from field to remove extra whitespace and quotes
          from = from.trim().replace(/^["']|["']$/g, '');

          // Clean up the subject field to remove extra whitespace and quotes
          subject = subject.trim().replace(/^["']|["']$/g, '');

          console.log('Extracted from header object - subject:', subject, 'from:', from);
        } else {
          // Fallback to string conversion if it's neither string nor object
          headerText = String(headerBody);
          console.log('Raw header text:', headerText.substring(0, 500)); // Log first 500 chars

          // Parse common headers using a more robust approach
          const headers = parseHeaders(headerText);
          console.log('Parsed headers:', headers);

          // Try to get subject from headers, with fallback
          subject = headers.subject || 'No Subject';

          // Try to get from from headers, with fallback
          from = headers.from || 'Unknown';

          console.log('Before cleanup - subject:', subject, 'from:', from);

          // Clean up the from field to remove extra whitespace and quotes
          from = from.trim().replace(/^["']|["']$/g, '');

          // Clean up the subject field to remove extra whitespace and quotes
          subject = subject.trim().replace(/^["']|["']$/g, '');

          console.log('After cleanup - subject:', subject, 'from:', from);

          to = headers.to || '';
          cc = headers.cc || '';
          messageId = headers['message-id'] || '';
          inReplyTo = headers['in-reply-to'] || '';
          references = headers.references || '';
          if (!dateValue && headers.date) {
            dateValue = headers.date;
          }
        }
      } catch (e) {
        console.error('Error parsing headers:', e);
      }
    }

    // As a fallback, try to get data from attributes if header parsing failed
    if (subject === 'No Subject' || from === 'Unknown') {
      console.log('Using fallback - envelope data');
      // Use type assertion to access envelope data
      const attrs: any = item.attributes;
      console.log('Item attributes envelope:', attrs?.envelope);
      if (attrs && attrs.envelope) { // Use envelope from attributes if available
        if (subject === 'No Subject' && attrs.envelope.subject) {
          subject = attrs.envelope.subject;
        }
        if (from === 'Unknown' && attrs.envelope.from && attrs.envelope.from.length > 0) {
          from = attrs.envelope.from.map((addr: any) =>
            addr.name ? `${addr.name} <${addr.address}>` : addr.address
          ).join(', ');
        }
        if (!dateValue && attrs.envelope.date) {
          dateValue = attrs.envelope.date;
        }
      }
    }

    console.log('Final values - subject:', subject, 'from:', from);

    let bodyContent: string | undefined;
    if (bodyPart?.body) {
      try {
        const parsed = await simpleParser(bodyPart.body);
        const plainText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>?/gm, ' ') : '');
        preview = plainText.trim().substring(0, 280).replace(/\s+/g, ' ');
        bodyContent = parsed.text || parsed.html || undefined;
      } catch {
        preview = 'Preview unavailable';
        bodyContent = undefined;
      }
    }

    return {
      uid: item.attributes.uid,
      date: dateValue,
      flags: item.attributes.flags,
      subject,
      from,
      to,
      cc,
      preview,
      body: bodyContent,
      messageId,
      inReplyTo,
      references,
    };
  }));
}

// Helper function to parse email headers
function parseHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = headerText.split(/\r?\n/);

  let currentHeader = '';
  let currentContent = '';

  for (const line of lines) {
    // Check if this is a new header line (starts with a non-whitespace character after optional spaces)
    if (/^\S/.test(line)) {
      // Save the previous header if it exists
      if (currentHeader) {
        headers[currentHeader.toLowerCase()] = currentContent.trim();
      }

      // Parse the new header line
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        currentHeader = match[1].trim();
        currentContent = match[2].trim();
      } else {
        currentHeader = '';
        currentContent = '';
      }
    } else if (currentHeader) {
      // This is a continuation of the previous header (indented)
      currentContent += ' ' + line.trim();
    }
  }

  // Save the last header
  if (currentHeader) {
    headers[currentHeader.toLowerCase()] = currentContent.trim();
  }

  return headers;
}


// Function to group emails into conversations
export function groupEmailsIntoConversations(emails: any[]): any[] {
  // Create a map of message IDs to emails for quick lookup
  const emailMap = new Map();
  emails.forEach(email => {
    if (email.messageId) {
      emailMap.set(email.messageId, email);
    }
  });

  // Group emails by subject (normalizing common prefixes like Re:, Fwd:, etc.)
  const conversationMap = new Map();

  emails.forEach(email => {
    // Normalize the subject by removing common prefixes
    const normalizedSubject = normalizeSubject(email.subject);

    if (!conversationMap.has(normalizedSubject)) {
      conversationMap.set(normalizedSubject, []);
    }

    conversationMap.get(normalizedSubject).push(email);
  });

  // Sort each conversation by date (oldest first)
  const conversations = Array.from(conversationMap.values()).map(conversation => {
    return conversation.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  // Sort conversations by the date of the latest email in each conversation
  return conversations.sort((a: any[], b: any[]) => {
    const lastEmailA = a[a.length - 1];
    const lastEmailB = b[b.length - 1];
    return new Date(lastEmailB.date).getTime() - new Date(lastEmailA.date).getTime();
  });
}

// Helper function to normalize email subjects for conversation grouping
function normalizeSubject(subject: string): string {
  if (!subject) return 'No Subject';

  // Remove common prefixes like Re:, Fwd:, etc.
  let normalized = subject.replace(/^(re|fw|fwd|回复|回复|Antwort|Réf|VS|VB|ODP|YNT|回复|回复|回复|回复):\s*/gi, '');

  // Remove leading/trailing whitespace
  normalized = normalized.trim();

  return normalized || 'No Subject';
}
