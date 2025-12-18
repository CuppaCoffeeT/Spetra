import type { TransactionInput } from '@/src/types';

export interface GmailMessage {
  id: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

export interface GmailAuthState {
  isConnected: boolean;
  lastSync?: string;
}

// Placeholder Gmail service. Replace with real OAuth + Gmail API integration later.
class GmailService {
  private state: GmailAuthState = { isConnected: false };

  connect = async () => {
    // TODO: Implement real OAuth flow. For now we simulate success.
    this.state = { isConnected: true, lastSync: new Date().toISOString() };
    return this.state;
  };

  disconnect = async () => {
    this.state = { isConnected: false };
    return this.state;
  };

  getState = () => {
    return this.state;
  };

  fetchRecentMessages = async (): Promise<GmailMessage[]> => {
    if (!this.state.isConnected) {
      throw new Error('Connect Gmail before syncing');
    }

    // Mocked data so UI can be wired up.
    return [
      {
        id: 'mock-1',
        subject: 'PAYNOW RECEIVED: SGD 48.10 from JOHN DOE',
        snippet: 'Ref 1234, Lunch split',
        receivedAt: new Date().toISOString(),
      },
      {
        id: 'mock-2',
        subject: 'Card Transaction: SGD 12.90 SHPEE*12345',
        snippet: 'Your UOB Visa was charged SGD 12.90 at SHPEE*12345',
        receivedAt: new Date().toISOString(),
      },
    ];
  };

  transformToTransactions = async (
    messages: GmailMessage[]
  ): Promise<TransactionInput[]> => {
    const { parseEmail } = await import('@/src/services/parser');
    return messages
      .map((message) => parseEmail(message))
      .filter((input): input is TransactionInput => Boolean(input));
  };
}

export const gmailService = new GmailService();
