// Server-side port of src/services/parser.ts (email → transaction fields).
// Kept regex-for-regex compatible so the edge `ingest` path and the legacy
// Expo Gmail-poll path extract identical descriptions — which makes their
// legacy dedupe hashes collide on the same underlying email (intended).

const AMOUNT_PATTERNS = [
  /(S\$|SGD)\s?([0-9,]+(?:\.[0-9]{2})?)/i,
  /([0-9,]+(?:\.[0-9]{2})?)\s?(S\$|SGD)/i,
];

const DATE_PATTERNS = [
  /(\d{2})-([A-Z]{3})-(\d{4})/i, // 08-DEC-2025
  /(\d{2})\/(\d{2})\/(\d{2})\b/, // 03/12/25
  /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/i, // 5 Dec 25
];

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const IN_KEYWORDS = ['received', 'credited', 'salary', 'refund', 'cashback'];
const OUT_KEYWORDS = ['paid', 'charged', 'debited', 'spent', 'transaction', 'was made', 'purchase', 'payment of', 'transfer of'];

const SKIP_SUBJECTS = [
  /eStatement/i,
  /eAdvice/i,
  /Card Wallet Provision/i,
  /is successful/i, // "Your PayNow transfer ... is successful" (dup of the actual alert)
];

const STRIP_PATTERNS = [
  /UOB EMAIL DISCLAIMER[\s\S]*/i,
  /If you did not [\s\S]*/i,
  /This is an auto-generated[\s\S]*/i,
  /amounts to a breach of confidentiality[\s\S]*/i,
  /Please do not reply[\s\S]*/i,
];

function cleanText(text: string): string {
  let cleaned = text;
  for (const pattern of STRIP_PATTERNS) cleaned = cleaned.replace(pattern, '');
  return cleaned;
}

export function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].includes('$') || match[1].includes('SGD') ? match[2] : match[1];
      return parseFloat(amountStr.replace(/,/g, ''));
    }
  }
  return null;
}

export function detectDirection(text: string): 'in' | 'out' {
  const lower = text.toLowerCase();
  for (const k of IN_KEYWORDS) if (lower.includes(k)) return 'in';
  for (const k of OUT_KEYWORDS) if (lower.includes(k)) return 'out';
  return 'out';
}

export function parseDateOrNull(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let day: number, month: number, year: number;
      if (pattern === DATE_PATTERNS[0]) {
        day = parseInt(match[1], 10);
        month = MONTH_MAP[match[2].toLowerCase()] ?? 0;
        year = parseInt(match[3], 10);
      } else if (pattern === DATE_PATTERNS[1]) {
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        year = 2000 + parseInt(match[3], 10);
      } else {
        day = parseInt(match[1], 10);
        month = MONTH_MAP[match[2].toLowerCase()] ?? 0;
        year = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
      }
      return new Date(year, month, day).toISOString();
    }
  }
  return null;
}

export function extractDescription(text: string, subject: string): string {
  const cleaned = cleanText(text);

  const netsMatch = cleaned.match(/payment of SGD\s?[\d,.]+\s+to\s+(.+?)\s+on your/i);
  if (netsMatch) return netsMatch[1].trim();

  const paynowTransferMatch = cleaned.match(/transfer of SGD\s?[\d,.]+\s+to\s+(.+?)\s*\(/i);
  if (paynowTransferMatch) return paynowTransferMatch[1].trim();

  if (/received SGD/i.test(cleaned)) return 'PayNow Received';

  const atMatch = cleaned.match(/\bat\s+([A-Za-z0-9][A-Za-z0-9\s\*\-\.&']+?)(?:\s+on\s+\d|\.\s|$)/i);
  if (atMatch) return atMatch[1].trim();

  if (/funds transfer/i.test(cleaned)) return 'Fund Transfer';

  return subject.replace(/UOB\s*-\s*/i, '').replace(/\[.*?\]/g, '').trim() || 'Unknown';
}

export interface ParsedEmailTxn {
  amount: number;
  currency: string;
  direction: 'in' | 'out';
  description: string;
  transactionDate: string;
}

// Parse a raw email into transaction fields. null = not a transaction email.
export function parseEmailText(
  subject: string,
  body: string,
  receivedAt: string
): ParsedEmailTxn | null {
  for (const pattern of SKIP_SUBJECTS) if (pattern.test(subject)) return null;

  const fullText = `${subject} ${body}`;
  const amount = extractAmount(fullText);
  if (!amount) return null;

  return {
    amount,
    currency: 'SGD',
    direction: detectDirection(fullText),
    description: extractDescription(fullText, subject),
    transactionDate: parseDateOrNull(fullText) ?? receivedAt,
  };
}

// Legacy dedupe hash — byte-identical to src/lib/db.ts generateDedupeHash /
// src/lib/sync.ts, so server-ingested emails collide with Expo Gmail-pulled
// duplicates of the same alert.
export function legacyDedupeHash(amount: number, date: string, description: string): string {
  const key = `${amount}-${date.substring(0, 10)}-${description.substring(0, 30).toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
