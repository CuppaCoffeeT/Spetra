import { parseISO } from 'date-fns';

import { GmailMessage } from '@/src/services/gmail';
import { TransactionInput, TransactionDirection } from '@/src/types';
import { categorizeDescription } from '@/src/services/categorizer';

const AMOUNT_REGEX = /(S\$|SGD)\s?([0-9,]+(?:\.[0-9]{2})?)/i;
const IN_KEYWORDS = ['received', 'credited', 'salary'];
const OUT_KEYWORDS = ['paid', 'charged', 'debited', 'spent'];

const cleanAmount = (raw: string) => Number(raw.replace(/,/g, ''));

const detectDirection = (text: string): TransactionDirection => {
  const lowered = text.toLowerCase();
  if (IN_KEYWORDS.some((keyword) => lowered.includes(keyword))) {
    return 'in';
  }
  if (OUT_KEYWORDS.some((keyword) => lowered.includes(keyword))) {
    return 'out';
  }
  return 'out';
};

const inferDatetime = (message: GmailMessage) => {
  try {
    return parseISO(message.receivedAt).toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
};

export const parseEmail = (
  message: GmailMessage
): TransactionInput | null => {
  const text = `${message.subject} ${message.snippet}`;
  const match = text.match(AMOUNT_REGEX);
  if (!match) {
    return null;
  }

  const amount = cleanAmount(match[2]);
  const direction = detectDirection(text);
  const description = message.subject.replace(match[0], '').trim();

  const category = categorizeDescription(description);

  return {
    amountNative: amount,
    currencyNative: 'SGD',
    direction,
    description: description || message.subject,
    category,
    txnDatetime: inferDatetime(message),
    source: 'email',
  };
};
