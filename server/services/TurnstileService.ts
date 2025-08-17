interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

export class TurnstileService {
  private readonly secretKey: string;
  private readonly verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  constructor(secretKey: string) {
    if (!secretKey) {
      throw new Error('Turnstile secret key is required');
    }
    this.secretKey = secretKey;
  }

  /**
   * Verify a Turnstile token against Cloudflare's API
   * @param token - The token from the client
   * @param ip - The client's IP address
   * @returns Promise<boolean> - Whether the token is valid
   */
  async verifyToken(token: string, ip?: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    try {
      // Use URLSearchParams instead of FormData for better Node.js compatibility
      const params = new URLSearchParams();
      params.append('secret', this.secretKey);
      params.append('response', token);
      
      if (ip) {
        params.append('remoteip', ip);
      }

      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        console.error('Turnstile verification request failed:', response.status, response.statusText);
        return false;
      }

      const result: TurnstileVerifyResponse = await response.json();

      if (!result.success) {
        console.warn('Turnstile verification failed:', result['error-codes']);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Turnstile verification error:', error);
      return false;
    }
  }

  /**
   * Verify a Turnstile token with additional validation
   * @param token - The token from the client
   * @param ip - The client's IP address
   * @param expectedAction - Optional expected action value
   * @param expectedHostname - Optional expected hostname
   * @returns Promise<{valid: boolean, error?: string}>
   */
  async verifyTokenWithValidation(
    token: string, 
    ip?: string, 
    expectedAction?: string, 
    expectedHostname?: string
  ): Promise<{valid: boolean, error?: string}> {
    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    try {
      // Use URLSearchParams instead of FormData for better Node.js compatibility
      const params = new URLSearchParams();
      params.append('secret', this.secretKey);
      params.append('response', token);
      
      if (ip) {
        params.append('remoteip', ip);
      }

      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        return { 
          valid: false, 
          error: `Verification request failed: ${response.status}` 
        };
      }

      const result: TurnstileVerifyResponse = await response.json();

      if (!result.success) {
        const errorCodes = result['error-codes'] || [];
        return { 
          valid: false, 
          error: `Verification failed: ${errorCodes.join(', ')}` 
        };
      }

      // Additional validation checks
      if (expectedAction && result.action !== expectedAction) {
        return { 
          valid: false, 
          error: `Action mismatch: expected ${expectedAction}, got ${result.action}` 
        };
      }

      if (expectedHostname && result.hostname !== expectedHostname) {
        return { 
          valid: false, 
          error: `Hostname mismatch: expected ${expectedHostname}, got ${result.hostname}` 
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Turnstile verification error:', error);
      return { 
        valid: false, 
        error: 'Verification service error' 
      };
    }
  }
}
