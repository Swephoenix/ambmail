export type ContactCandidate = {
  email: string;
  name?: string | null;
};

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeName(name: string) {
  return name.replace(/^["']|["']$/g, '').trim();
}

export function extractContactsFromHeader(header: string | null): ContactCandidate[] {
  if (!header) return [];
  const parts = header.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  const candidates: ContactCandidate[] = [];

  for (const part of parts) {
    const emails = part.match(EMAIL_REGEX);
    if (!emails || emails.length === 0) continue;

    for (const email of emails) {
      let name = '';
      const angleMatch = part.match(/^(.*)<\s*([^>]+)\s*>/);
      if (angleMatch) {
        name = sanitizeName(angleMatch[1] || '');
      } else {
        const withoutEmail = part.replace(email, '').replace(/[<>"]/g, '').trim();
        name = sanitizeName(withoutEmail);
      }

      candidates.push({
        email,
        name: name || null,
      });
    }
  }

  return candidates;
}

export function uniqueContacts(
  candidates: ContactCandidate[],
  excludeEmails: string[] = []
) {
  const excluded = new Set(excludeEmails.map((email) => normalizeEmail(email)));
  const map = new Map<string, ContactCandidate>();

  for (const candidate of candidates) {
    const emailRaw = candidate.email?.trim();
    if (!emailRaw) continue;
    const normalized = normalizeEmail(emailRaw);
    if (excluded.has(normalized)) continue;

    if (!map.has(normalized)) {
      map.set(normalized, { email: emailRaw, name: candidate.name || null });
    }
  }

  return Array.from(map.values());
}

export function buildContactRows(userId: string, candidates: ContactCandidate[]) {
  return candidates.map((candidate) => {
    const name = candidate.name || candidate.email.split('@')[0];
    return {
      userId,
      email: candidate.email,
      name,
    };
  });
}
