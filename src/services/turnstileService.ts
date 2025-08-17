interface TurnstileVerifyResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export class TurnstileService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '/proxy') {
    this.baseUrl = baseUrl;
  }

  /**
   * Verify a Turnstile token with the server
   * @param token - The token from the Turnstile widget
   * @param action - Optional action identifier
   * @returns Promise<boolean> - Whether the token is valid
   */
  async verifyToken(token: string, action?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/verify-turnstile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, action }),
      });

      if (!response.ok) {
        console.error('Turnstile verification failed:', response.status, response.statusText);
        return false;
      }

      const result: TurnstileVerifyResponse = await response.json();
      return result.success;
    } catch (error) {
      console.error('Turnstile verification error:', error);
      return false;
    }
  }

  /**
   * Verify a Turnstile token with detailed error information
   * @param token - The token from the Turnstile widget
   * @param action - Optional action identifier
   * @returns Promise<{valid: boolean, error?: string}>
   */
  async verifyTokenWithDetails(token: string, action?: string): Promise<{valid: boolean, error?: string}> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/verify-turnstile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, action }),
      });

      if (!response.ok) {
        return { 
          valid: false, 
          error: `Verification failed: ${response.status} ${response.statusText}` 
        };
      }

      const result: TurnstileVerifyResponse = await response.json();
      
      if (result.success) {
        return { valid: true };
      } else {
        return { 
          valid: false, 
          error: result.error || 'Token verification failed' 
        };
      }
    } catch (error) {
      console.error('Turnstile verification error:', error);
      return { 
        valid: false, 
        error: 'Network error during verification' 
      };
    }
  }

  /**
   * Check if the Turnstile service is available
   * @returns Promise<boolean> - Whether the service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/turnstile-health`);
      if (!response.ok) return false;
      
      const result = await response.json();
      return result.success && result.configured;
    } catch (error) {
      console.error('Turnstile health check error:', error);
      return false;
    }
  }
}

// Export a default instance
export const turnstileService = new TurnstileService();
