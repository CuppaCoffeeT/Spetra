import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { GmailMessage, GmailAuthState } from '../types';

// Only complete auth session on native
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

const ACCOUNTS_KEY = 'gmail_accounts';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Cross-platform storage
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
};

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email: string;
}

// Stored as Record<email, StoredTokens>
type StoredAccounts = Record<string, StoredTokens>;

class GmailService {
  private clientId: string | null = null;
  private accounts: StoredAccounts = {};
  private fetchInProgress: Promise<GmailMessage[]> | null = null;

  async initialize(clientId: string) {
    this.clientId = clientId;
    await this.loadStoredAccounts();
  }

  private async loadStoredAccounts() {
    try {
      // Migrate from old single-token format
      const oldTokens = await storage.getItem('gmail_tokens');
      if (oldTokens) {
        const parsed = JSON.parse(oldTokens) as StoredTokens;
        if (parsed.email) {
          this.accounts[parsed.email] = parsed;
          await this.saveAccounts();
        }
        await storage.deleteItem('gmail_tokens');
      }

      const stored = await storage.getItem(ACCOUNTS_KEY);
      if (stored) {
        this.accounts = JSON.parse(stored);
        // Remove fully expired accounts without refresh tokens
        let changed = false;
        for (const email of Object.keys(this.accounts)) {
          const tokens = this.accounts[email];
          if (tokens.expiresAt <= Date.now() && !tokens.refreshToken) {
            delete this.accounts[email];
            changed = true;
          }
        }
        if (changed) await this.saveAccounts();
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  }

  private async saveAccounts() {
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
  }

  getState(): GmailAuthState {
    return {
      accounts: Object.keys(this.accounts).map((email) => ({ email })),
    };
  }

  getRedirectUri(): string {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    }
    return AuthSession.makeRedirectUri({ scheme: 'spendtracker' });
  }

  async connect(): Promise<GmailAuthState> {
    if (!this.clientId) {
      throw new Error('Gmail service not initialized');
    }

    const redirectUri = this.getRedirectUri();

    if (Platform.OS === 'web') {
      return this.connectWeb(redirectUri);
    }

    // Native flow with PKCE
    const request = new AuthSession.AuthRequest({
      clientId: this.clientId,
      scopes: SCOPES,
      redirectUri,
      usePKCE: true,
      extraParams: { access_type: 'offline', prompt: 'consent' },
    });

    const result = await request.promptAsync(discovery);

    if (result.type === 'success' && result.params.code) {
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: this.clientId,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? '' },
        },
        discovery
      );

      const userInfo = await this.fetchUserInfo(tokenResponse.accessToken);

      this.accounts[userInfo.email] = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt: Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000,
        email: userInfo.email,
      };

      await this.saveAccounts();
    }

    return this.getState();
  }

  private connectWeb(redirectUri: string): Promise<GmailAuthState> {
    return new Promise((resolve) => {
      // Check if we already have a token in the URL hash (returning from OAuth)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const expiresIn = hashParams.get('expires_in');

        if (accessToken) {
          window.history.replaceState(null, '', window.location.pathname);

          this.fetchUserInfo(accessToken).then((userInfo) => {
            this.accounts[userInfo.email] = {
              accessToken,
              expiresAt: Date.now() + (parseInt(expiresIn || '3600', 10) * 1000),
              email: userInfo.email,
            };
            this.saveAccounts();
            resolve(this.getState());
          }).catch(() => {
            resolve(this.getState());
          });
          return;
        }
      }

      // Build OAuth URL and redirect
      const params = new URLSearchParams({
        client_id: this.clientId!,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: SCOPES.join(' '),
        include_granted_scopes: 'true',
        prompt: 'consent',
      });

      window.location.href = `${discovery.authorizationEndpoint}?${params.toString()}`;
      resolve(this.getState());
    });
  }

  async checkOAuthCallback(): Promise<boolean> {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

    const hash = window.location.hash;
    if (!hash) return false;

    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const expiresIn = hashParams.get('expires_in');

    if (accessToken) {
      window.history.replaceState(null, '', window.location.pathname);

      try {
        const userInfo = await this.fetchUserInfo(accessToken);
        this.accounts[userInfo.email] = {
          accessToken,
          expiresAt: Date.now() + (parseInt(expiresIn || '3600', 10) * 1000),
          email: userInfo.email,
        };
        await this.saveAccounts();
        return true;
      } catch (error) {
        console.error('OAuth callback failed:', error);
      }
    }

    return false;
  }

  private async fetchUserInfo(accessToken: string): Promise<{ email: string }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to fetch user info');
    return response.json();
  }

  private async refreshAccessToken(email: string) {
    const tokens = this.accounts[email];
    if (!this.clientId || !tokens?.refreshToken) return;

    try {
      const response = await AuthSession.refreshAsync(
        { clientId: this.clientId, refreshToken: tokens.refreshToken },
        discovery
      );

      this.accounts[email] = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? tokens.refreshToken,
        expiresAt: Date.now() + (response.expiresIn ?? 3600) * 1000,
        email,
      };

      await this.saveAccounts();
    } catch {
      await this.disconnect(email);
    }
  }

  private async getValidAccessToken(email: string): Promise<string> {
    const tokens = this.accounts[email];
    if (!tokens) throw new Error(`Not connected to Gmail account: ${email}`);

    if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
      if (tokens.refreshToken) {
        await this.refreshAccessToken(email);
      } else {
        // Implicit flow token expired — remove stale account
        delete this.accounts[email];
        await this.saveAccounts();
        throw new Error(`Gmail session expired for ${email}. Please reconnect in Settings.`);
      }
    }

    const refreshed = this.accounts[email];
    if (!refreshed?.accessToken) throw new Error(`No valid access token for: ${email}`);
    return refreshed.accessToken;
  }

  async disconnect(email: string): Promise<GmailAuthState> {
    const tokens = this.accounts[email];
    if (tokens?.accessToken) {
      try {
        await AuthSession.revokeAsync({ token: tokens.accessToken }, discovery);
      } catch (error) {
        console.error('Revocation failed:', error);
      }
    }
    delete this.accounts[email];
    await this.saveAccounts();
    return this.getState();
  }

  async fetchRecentMessages(maxResults = 50, daysBack = 30): Promise<GmailMessage[]> {
    // Deduplicate concurrent calls to prevent ERR_INSUFFICIENT_RESOURCES
    if (this.fetchInProgress) {
      return this.fetchInProgress;
    }
    this.fetchInProgress = this._fetchRecentMessages(maxResults, daysBack);
    try {
      return await this.fetchInProgress;
    } finally {
      this.fetchInProgress = null;
    }
  }

  private async _fetchRecentMessages(maxResults: number, daysBack: number): Promise<GmailMessage[]> {
    const emails = Object.keys(this.accounts);
    if (emails.length === 0) return [];

    const senders = ['unialerts@uobgroup.com', 'noreply@revolut.com'];
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - daysBack);
    const afterDateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');

    const query = `from:(${senders.join(' OR ')}) after:${afterDateStr}`;
    const encodedQuery = encodeURIComponent(query);

    console.log('[Gmail] Query:', query);
    console.log('[Gmail] Fetching from accounts:', emails.join(', '));

    const allMessages: GmailMessage[] = [];

    for (const email of emails) {
      try {
        const accessToken = await this.getValidAccessToken(email);
        console.log(`[Gmail] Fetching from ${email}...`);

        const listResponse = await this.fetchWithTimeout(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodedQuery}&maxResults=${maxResults}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          20000
        );

        if (!listResponse.ok) {
          console.error(`[Gmail] Failed for ${email}:`, await listResponse.text());
          continue;
        }

        const listData = await listResponse.json();
        console.log(`[Gmail] ${email}: found ${listData.messages?.length ?? 0} messages`);
        const messageIds: { id: string; threadId: string }[] = listData.messages ?? [];

        if (messageIds.length === 0) {
          console.log(`[Gmail] ${email}: No messages found. Testing API...`);
          const testResponse = await this.fetchWithTimeout(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const testData = await testResponse.json();
          console.log(`[Gmail] ${email}: Broad test - found ${testData.messages?.length ?? 0} messages`);
          continue;
        }

        // Fetch details in batches to avoid ERR_INSUFFICIENT_RESOURCES
        const batchSize = 5;
        for (let i = 0; i < messageIds.length; i += batchSize) {
          const batch = messageIds.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map((msg) => this.fetchMessageDetail(accessToken, msg.id))
          );
          allMessages.push(...batchResults.filter((m): m is GmailMessage => m !== null));
        }
      } catch (error) {
        console.error(`[Gmail] Error fetching from ${email}:`, error);
      }
    }

    return allMessages;
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchMessageDetail(accessToken: string, messageId: string): Promise<GmailMessage | null> {
    try {
      const response = await this.fetchWithTimeout(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const headers = data.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      let body = '';
      if (data.payload?.body?.data) {
        body = this.decodeBase64(data.payload.body.data);
      } else if (data.payload?.parts) {
        body = this.extractBodyFromParts(data.payload.parts);
      }

      return {
        id: data.id,
        threadId: data.threadId,
        subject: getHeader('Subject'),
        snippet: data.snippet ?? '',
        from: getHeader('From'),
        receivedAt: getHeader('Date') ? new Date(getHeader('Date')).toISOString() : new Date().toISOString(),
        body,
      };
    } catch {
      return null;
    }
  }

  private extractBodyFromParts(parts: Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }>): string {
    // Try text/plain first
    const textPart = parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return this.decodeBase64(textPart.body.data);
    }

    // Fall back to text/html, strip tags
    const htmlPart = parts.find((p) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      const html = this.decodeBase64(htmlPart.body.data);
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Check nested multipart (e.g., multipart/alternative inside multipart/mixed)
    for (const part of parts) {
      if (part.parts) {
        const nested = this.extractBodyFromParts(
          part.parts as Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }>
        );
        if (nested) return nested;
      }
    }

    return '';
  }

  private decodeBase64(data: string): string {
    try {
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      return decodeURIComponent(escape(atob(base64)));
    } catch {
      return '';
    }
  }
}

export const gmailService = new GmailService();
