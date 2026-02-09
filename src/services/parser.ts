import type { GmailMessage, TransactionInput } from '../types';
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
const OUT_KEYWORDS = ['paid', 'charged', 'debited', 'spent', 'transaction', 'was made', 'purchase'];

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

function parseDate(text: string, fallbackDate: string): string {
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
  return fallbackDate;
}

function extractDescription(text: string, subject: string): string {
  // Try to extract merchant from "at MERCHANT" pattern
  const atMatch = text.match(/at\s+([A-Z0-9\s\*\-\.]+?)(?:\.|If|$)/i);
  if (atMatch) {
    return atMatch[1].trim();
  }

  // Try PayNow pattern
  const paynowMatch = text.match(/(?:to|from)\s+([A-Z\s]+?)(?:\s+\(|\s+on|\.|$)/i);
  if (paynowMatch) {
    return paynowMatch[1].trim();
  }

  // Fallback to subject
  return subject.replace(/\[.*?\]/g, '').trim() || 'Unknown';
}

export function parseEmail(message: GmailMessage): TransactionInput | null {
  const fullText = `${message.subject} ${message.body} ${message.snippet}`;

  const amount = extractAmount(fullText);
  if (!amount) return null;

  const direction = detectDirection(fullText);
  const transactionDate = parseDate(fullText, message.receivedAt);
  const description = extractDescription(fullText, message.subject);
  const category = categorize(description);

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
