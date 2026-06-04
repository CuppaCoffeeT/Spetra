import type { GmailMessage, TransactionInput, BankAccountInput } from '../types';
import { categorize } from './categorizer';

// Amount patterns for SGD
const AMOUNT_PATTERNS = [
  /(S\$|SGD)\s?([0-9,]+(?:\.[0-9]{2})?)/i,
  /([0-9,]+(?:\.[0-9]{2})?)\s?(S\$|SGD)/i,
];

// Date patterns
const DATE_PATTERNS = [
  /(\d{2})-([A-Z]{3})-(\d{4})/i,           // 08-DEC-2025
  /(\d{2})\/(\d{2})\/(\d{2})\b/,           // 03/12/25
  /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/i, // 5 Dec 25
];

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Direction keywords
const IN_KEYWORDS = ['received', 'credited', 'salary', 'refund', 'cashback'];
const OUT_KEYWORDS = ['paid', 'charged', 'debited', 'spent', 'transaction', 'was made', 'purchase', 'payment of', 'transfer of'];

// Subjects to skip entirely (not actual transactions)
const SKIP_SUBJECTS = [
  /eStatement/i,
  /eAdvice/i,
  /Card Wallet Provision/i,
  /is successful/i,  // "Your PayNow transfer ... is successful" (duplicate of actual transfer alert)
];

// UOB disclaimer / boilerplate to strip before description extraction
const STRIP_PATTERNS = [
  /UOB EMAIL DISCLAIMER[\s\S]*/i,
  /If you did not [\s\S]*/i,
  /This is an auto-generated[\s\S]*/i,
  /amounts to a breach of confidentiality[\s\S]*/i,
  /Please do not reply[\s\S]*/i,
];

function cleanText(text: string): string {
  let cleaned = text;
  for (const pattern of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
}

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].includes('$') || match[1].includes('SGD')
        ? match[2]
        : match[1];
      return parseFloat(amountStr.replace(/,/g, ''));
    }
  }
  return null;
}

function detectDirection(text: string): 'in' | 'out' {
  const lowerText = text.toLowerCase();
  for (const keyword of IN_KEYWORDS) {
    if (lowerText.includes(keyword)) return 'in';
  }
  for (const keyword of OUT_KEYWORDS) {
    if (lowerText.includes(keyword)) return 'out';
  }
  return 'out'; // Default to expense
}

// Parse the first recognized date in `text`, or return null if none match.
// Shared by email parsing (parseDate, with a fallback) and receipt parsing.
export function parseDateOrNull(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let day: number, month: number, year: number;

      if (pattern === DATE_PATTERNS[0]) {
        // DD-MMM-YYYY
        day = parseInt(match[1], 10);
        month = MONTH_MAP[match[2].toLowerCase()] ?? 0;
        year = parseInt(match[3], 10);
      } else if (pattern === DATE_PATTERNS[1]) {
        // DD/MM/YY
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        year = 2000 + parseInt(match[3], 10);
      } else {
        // D MMM YY(YY)
        day = parseInt(match[1], 10);
        month = MONTH_MAP[match[2].toLowerCase()] ?? 0;
        year = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
      }

      const date = new Date(year, month, day);
      return date.toISOString();
    }
  }
  return null;
}

function parseDate(text: string, fallbackDate: string): string {
  return parseDateOrNull(text) ?? fallbackDate;
}

function extractDescription(text: string, subject: string): string {
  const cleaned = cleanText(text);

  // NETS QR: "payment of SGD X.XX to MERCHANT on your"
  const netsMatch = cleaned.match(/payment of SGD\s?[\d,.]+\s+to\s+(.+?)\s+on your/i);
  if (netsMatch) {
    return netsMatch[1].trim();
  }

  // PayNow transfer: "transfer of SGD X.XX to RECIPIENT (Mobile/UEN ending XXX)"
  const paynowTransferMatch = cleaned.match(/transfer of SGD\s?[\d,.]+\s+to\s+(.+?)\s*\(/i);
  if (paynowTransferMatch) {
    return paynowTransferMatch[1].trim();
  }

  // PayNow received: "received SGD X.XX in your PayNow-linked account"
  const paynowReceivedMatch = cleaned.match(/received SGD/i);
  if (paynowReceivedMatch) {
    return 'PayNow Received';
  }

  // Card transaction: "at MERCHANT on DD/MM/YY" or "at MERCHANT."
  const atMatch = cleaned.match(/\bat\s+([A-Za-z0-9][A-Za-z0-9\s\*\-\.&']+?)(?:\s+on\s+\d|\.\s|$)/i);
  if (atMatch) {
    return atMatch[1].trim();
  }

  // Fund transfer: "funds transfer(s) of SGD X"
  const fundTransferMatch = cleaned.match(/funds transfer/i);
  if (fundTransferMatch) {
    return 'Fund Transfer';
  }

  // Fallback to cleaned subject
  return subject
    .replace(/UOB\s*-\s*/i, '')
    .replace(/\[.*?\]/g, '')
    .trim() || 'Unknown';
}

function shouldSkip(message: GmailMessage): boolean {
  for (const pattern of SKIP_SUBJECTS) {
    if (pattern.test(message.subject)) return true;
  }
  return false;
}

export function parseEmail(message: GmailMessage): TransactionInput | null {
  if (shouldSkip(message)) return null;

  const fullText = `${message.subject} ${message.body} ${message.snippet}`;

  const amount = extractAmount(fullText);
  if (!amount) return null;

  const direction = detectDirection(fullText);
  const transactionDate = parseDate(fullText, message.receivedAt);
  const description = extractDescription(fullText, message.subject);
  const category = categorize(description + ' ' + message.subject);

  return {
    amount,
    currency: 'SGD',
    direction,
    description,
    category,
    transactionDate,
    source: 'email',
    sourceEmail: message.from,
  };
}

export function parseEmails(messages: GmailMessage[]): TransactionInput[] {
  return messages
    .map(parseEmail)
    .filter((input): input is TransactionInput => input !== null);
}

// Extract bank accounts/cards from email content
const ACCOUNT_PATTERNS = [
  { pattern: /card ending (\d{4})/gi, type: 'card' as const, bank: 'UOB' },
  { pattern: /a\/c ending (\d{4})/gi, type: 'account' as const, bank: 'UOB' },
];

// --- Receipt OCR field extraction -----------------------------------------

// Matches a decimal money value, optionally currency-prefixed (S$/SGD/$).
// Capturing group 1 = the numeric part (with optional thousands separators).
const RECEIPT_DECIMAL = /(?:S\$|SGD|\$)?\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/gi;

function parseMoney(raw: string): number | null {
  const value = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

// Extract structured fields from raw OCR text of a receipt.
// - amount: value on the line labelled total/amount/grand total (case-insensitive),
//   else the largest decimal number anywhere in the text.
// - transactionDate: reuses the shared email date parser (parseDateOrNull).
// - merchant: first non-empty line, trimmed and capped at ~40 chars.
export function extractReceiptFields(text: string): {
  amount: number | null;
  transactionDate: string | null;
  merchant: string | null;
} {
  const lines = text.split(/\r?\n/);

  // 1. amount — prefer a value on a labelled total line.
  let amount: number | null = null;
  for (const line of lines) {
    if (/grand\s*total|total|amount/i.test(line)) {
      const matches = line.match(RECEIPT_DECIMAL);
      if (matches && matches.length > 0) {
        // Use the last money value on the label line (the figure usually
        // follows the label).
        const candidate = parseMoney(matches[matches.length - 1]);
        if (candidate !== null) {
          amount = candidate;
          break;
        }
      }
    }
  }

  // Fallback: the largest decimal number found anywhere in the text.
  if (amount === null) {
    let max: number | null = null;
    let match: RegExpExecArray | null;
    RECEIPT_DECIMAL.lastIndex = 0;
    while ((match = RECEIPT_DECIMAL.exec(text)) !== null) {
      const value = parseMoney(match[1]);
      if (value !== null && (max === null || value > max)) {
        max = value;
      }
    }
    amount = max;
  }

  // 2. transactionDate — reuse the shared date parser (no duplication).
  const transactionDate = parseDateOrNull(text);

  // 3. merchant — first non-empty line, trimmed and capped.
  let merchant: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      merchant = trimmed.slice(0, 40);
      break;
    }
  }

  return { amount, transactionDate, merchant };
}

export function extractAccounts(messages: GmailMessage[]): BankAccountInput[] {
  const seen = new Set<string>();
  const accounts: BankAccountInput[] = [];

  for (const msg of messages) {
    const fullText = `${msg.subject} ${msg.body} ${msg.snippet}`;
    const fromLower = msg.from.toLowerCase();

    // Detect bank from sender
    let defaultBank = 'Unknown';
    if (fromLower.includes('uob')) defaultBank = 'UOB';
    else if (fromLower.includes('revolut')) defaultBank = 'Revolut';

    for (const { pattern, type, bank } of ACCOUNT_PATTERNS) {
      // Reset regex lastIndex for each message
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(fullText)) !== null) {
        const digits = match[1];
        const key = `${bank}-${type}-${digits}`;
        if (!seen.has(key)) {
          seen.add(key);
          accounts.push({
            bankName: bank,
            accountType: type,
            lastFourDigits: digits,
            sourceEmail: msg.from,
          });
        }
      }
    }

    // Revolut emails - detect as account if from Revolut
    if (defaultBank === 'Revolut') {
      const key = `Revolut-account-revolut`;
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push({
          bankName: 'Revolut',
          accountType: 'account',
          lastFourDigits: '****',
          sourceEmail: msg.from,
        });
      }
    }
  }

  return accounts;
}
