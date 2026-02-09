import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { GmailMessage, GmailAuthState } from '../types';

// Only complete auth session on native
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

const TOKEN_KEY = 'gmail_tokens';
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
  email?: string;
}

class GmailService {
  private clientId: string | null = null;
  private state: GmailAuthState = { isConnected: false };
  private tokens: StoredTokens | null = null;

  initialize(clientId: string) {
    this.clientId = clientId;
    void this.loadStoredTokens();
  }

  private async loadStoredTokens() {
    try {
      const stored = await storage.getItem(TOKEN_KEY);
      if (stored) {
        this.tokens = JSON.parse(stored);
        if (this.tokens && this.tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
          this.state = { isConnected: true, email: this.tokens.email };
        } else if (this.tokens?.refreshToken) {
          await this.refreshAccessToken();
        }
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  }

  private async saveTokens(tokens: StoredTokens) {
    this.tokens = tokens;
    await storage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }

  private async clearTokens() {
    this.tokens = null;
    await storage.deleteItem(TOKEN_KEY);
  }

  getState(): GmailAuthState {
    return this.state;
  }

  getRedirectUri(): string {
    if (Platform.OS === 'web') {
      // Use root URL for OAuth callback - we handle it in _layout.tsx
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
      // For web, use implicit flow with access token directly
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

      const tokens: StoredTokens = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt: Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000,
        email: userInfo.email,
      };

      await this.saveTokens(tokens);
      this.state = { isConnected: true, email: userInfo.email };
    }

    return this.state;
  }

  private connectWeb(redirectUri: string): Promise<GmailAuthState> {
    return new Promise((resolve) => {
      // Build OAuth URL for implicit flow
      const params = new URLSearchParams({
        client_id: this.clientId!,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: SCOPES.join(' '),
        include_granted_scopes: 'true',
        prompt: 'consent',
      });

      const authUrl = `${discovery.authorizationEndpoint}?${params.toString()}`;

      // Check if we already have a token in the URL hash (returning from OAuth)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const expiresIn = hashParams.get('expires_in');

        if (accessToken) {
          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);

          // Save token and fetch user info
          this.fetchUserInfo(accessToken).then((userInfo) => {
            const tokens: StoredTokens = {
              accessToken,
              expiresAt: Date.now() + (parseInt(expiresIn || '3600', 10) * 1000),
              email: userInfo.email,
            };
            this.saveTokens(tokens);
            this.state = { isConnected: true, email: userInfo.email };
            resolve(this.state);
          }).catch(() => {
            resolve(this.state);
          });
          return;
        }
      }

      // Redirect to Google OAuth
      window.location.href = authUrl;
      resolve(this.state);
    });
  }

  // Call this on page load to check for OAuth callback
  async checkOAuthCallback(): Promise<boolean> {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

    const hash = window.location.hash;
    if (!hash) return false;

    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const expiresIn = hashParams.get('expires_in');

    if (accessToken) {
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);

      try {
        const userInfo = await this.fetchUserInfo(accessToken);
        const tokens: StoredTokens = {
          accessToken,
          expiresAt: Date.now() + (parseInt(expiresIn || '3600', 10) * 1000),
          email: userInfo.email,
        };
        await this.saveTokens(tokens);
        this.state = { isConnected: true, email: userInfo.email };
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

  private async refreshAccessToken() {
    if (!this.clientId || !this.tokens?.refreshToken) return;

    try {
      const response = await AuthSession.refreshAsync(
        { clientId: this.clientId, refreshToken: this.tokens.refreshToken },
        discovery
      );

      const tokens: StoredTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? this.tokens.refreshToken,
        expiresAt: Date.now() + (response.expiresIn ?? 3600) * 1000,
        email: this.tokens.email,
      };

      await this.saveTokens(tokens);
      this.state = { isConnected: true, email: tokens.email };
    } catch {
      await this.disconnect();
    }
  }

  private async getValidAccessToken(): Promise<string> {
    if (!this.tokens) throw new Error('Not connected to Gmail');

    if (this.tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    if (!this.tokens?.accessToken) throw new Error('No valid access token');
    return this.tokens.accessToken;
  }

  async disconnect(): Promise<GmailAuthState> {
    if (this.tokens?.accessToken) {
      try {
        await AuthSession.revokeAsync({ token: this.tokens.accessToken }, discovery);
      } catch (error) {
        console.error('Revocation failed:', error);
      }
    }
    await this.clearTokens();
    this.state = { isConnected: false };
    return this.state;
  }

  async fetchRecentMessages(maxResults = 50, daysBack = 30): Promise<GmailMessage[]> {
    const accessToken = await this.getValidAccessToken();

    const senders = ['unialerts@uobgroup.com', 'noreply@revolut.com'];
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - daysBack);
    const afterDateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');

    const query = `from:(${senders.join(' OR ')}) after:${afterDateStr}`;
    const encodedQuery = encodeURIComponent(query);

    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodedQuery}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
      throw new Error(`Failed to list messages: ${await listResponse.text()}`);
    }

    const listData = await listResponse.json();
    const messageIds: { id: string; threadId: string }[] = listData.messages ?? [];

    if (messageIds.length === 0) return [];

    const messages: GmailMessage[] = [];
    const batchSize = 10;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((msg) => this.fetchMessageDetail(accessToken, msg.id))
      );
      messages.push(...batchResults.filter((m): m is GmailMessage => m !== null));
    }

    this.state.lastSync = new Date().toISOString();
    return messages;
  }

  private async fetchMessageDetail(accessToken: string, messageId: string): Promise<GmailMessage | null> {
    try {
      const response = await fetch(
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
        const textPart = data.payload.parts.find((p: { mimeType: string }) => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = this.decodeBase64(textPart.body.data);
        }
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
