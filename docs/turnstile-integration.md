# Cloudflare Turnstile Integration

This document describes how to set up and use Cloudflare Turnstile for bot protection on login and signup forms.

## Overview

Cloudflare Turnstile is a privacy-first, free CAPTCHA alternative that protects your forms from bots and automated abuse. It's integrated into both the client-side authentication forms and server-side validation.

## Setup

### 1. Get Turnstile Keys

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Navigate to **Security** → **Turnstile**
3. Click **Add site**
4. Choose your widget type (recommended: **Managed**)
5. Add your domain(s)
6. Copy the **Site Key** and **Secret Key**

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Server-side (required)
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# Client-side (required)
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

### 3. Server Configuration

The server automatically registers Turnstile routes when `TURNSTILE_SECRET_KEY` is set:

- `POST /auth/verify-turnstile` - Verify tokens
- `GET /auth/turnstile-health` - Health check

## Features

### Client-Side Integration

- **Automatic Script Loading**: Turnstile script is loaded dynamically
- **Responsive Design**: Adapts to light/dark themes automatically
- **Error Handling**: Comprehensive error states and user feedback
- **Accessibility**: Proper ARIA labels and keyboard navigation

### Server-Side Validation

- **Token Verification**: Validates tokens against Cloudflare's API
- **IP Tracking**: Records client IP for additional security
- **Action Validation**: Optional action-based verification
- **Error Logging**: Detailed error reporting for debugging

### Security Features

- **Rate Limiting**: Built-in protection against abuse
- **IP Validation**: Ensures requests come from legitimate sources
- **Token Expiration**: Automatic token refresh and validation
- **Fallback Handling**: Graceful degradation when service is unavailable

## Usage

### Basic Integration

The Turnstile widget is automatically included in the Auth component when the service is available:

```tsx
import { Turnstile } from '@/components/Turnstile';

<Turnstile
  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
  onVerify={handleTurnstileVerify}
  onError={handleTurnstileError}
  onExpire={handleTurnstileExpire}
  theme="auto"
  size="normal"
  appearance="always"
/>
```

### Customization Options

```tsx
<Turnstile
  siteKey="your-site-key"
  onVerify={(token) => console.log('Verified:', token)}
  onError={() => console.log('Verification failed')}
  onExpire={() => console.log('Token expired')}
  theme="dark" // 'light' | 'dark' | 'auto'
  size="compact" // 'normal' | 'compact' | 'invisible'
  appearance="interaction-only" // 'always' | 'execute' | 'interaction-only'
  className="custom-styles"
/>
```

### Server-Side Verification

```typescript
import { TurnstileService } from '@/services/TurnstileService';

const turnstileService = new TurnstileService(secretKey);
const isValid = await turnstileService.verifyToken(token, clientIP);
```

## Configuration

### Widget Types

- **Managed**: Automatically challenges suspicious users (recommended)
- **Non-Interactive**: Always invisible, no user interaction required
- **Invisible**: Hidden until needed, then shows challenge

### Appearance Modes

- **Always**: Widget always visible
- **Execute**: Widget executes automatically
- **Interaction-Only**: Widget appears only during interaction

### Themes

- **Auto**: Respects user's system preference
- **Light**: Always light theme
- **Dark**: Always dark theme

## Troubleshooting

### Common Issues

1. **Widget Not Loading**
   - Check if `VITE_TURNSTILE_SITE_KEY` is set
   - Verify the site key is correct
   - Check browser console for errors

2. **Verification Failing**
   - Ensure `TURNSTILE_SECRET_KEY` is set on server
   - Check server logs for verification errors
   - Verify domain is added to Turnstile dashboard

3. **Service Unavailable**
   - Check `/auth/turnstile-health` endpoint
   - Verify environment variables are loaded
   - Check server logs for configuration errors

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

### Health Check

Test the service health:

```bash
curl http://localhost:8787/auth/turnstile-health
```

## Best Practices

1. **Always validate server-side**: Client-side verification can be bypassed
2. **Use appropriate widget types**: Choose based on your security needs
3. **Handle errors gracefully**: Provide clear feedback to users
4. **Monitor usage**: Track verification success/failure rates
5. **Regular key rotation**: Update keys periodically for security

## Security Considerations

- **Never expose secret keys**: Keep `TURNSTILE_SECRET_KEY` server-side only
- **Validate IP addresses**: Use IP validation for additional security
- **Rate limiting**: Implement rate limiting on verification endpoints
- **Token expiration**: Handle expired tokens appropriately
- **Error logging**: Log verification failures for monitoring

## Performance

- **Lazy loading**: Turnstile script loads only when needed
- **Minimal bundle impact**: Component is tree-shakeable
- **Efficient validation**: Server-side validation is optimized
- **Caching**: Health checks are cached appropriately

## Support

For Turnstile-specific issues:
- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Turnstile API Reference](https://developers.cloudflare.com/turnstile/reference/)
- [Cloudflare Community](https://community.cloudflare.com/)

For integration issues:
- Check server logs for detailed error messages
- Verify environment variable configuration
- Test health check endpoints
- Review browser console for client-side errors
