import { SecretInjectionPreview } from '../types';

/**
 * Finds all secret placeholders in a Docker Compose content string
 * Placeholders are in the format ${SECRET_NAME}
 */
export function findSecretPlaceholders(composeContent: string): string[] {
    const placeholderRegex = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
    const placeholders = new Set<string>();
    let match;

    while ((match = placeholderRegex.exec(composeContent)) !== null) {
        placeholders.add(match[1]);
    }

    return Array.from(placeholders);
}

/**
 * Injects secrets into Docker Compose content
 * Replaces ${SECRET_NAME} placeholders with actual secret values
 */
export function injectSecrets(
    composeContent: string,
    secrets: Record<string, string>
): string {
    let injectedContent = composeContent;

    // Replace each placeholder with its corresponding secret value
    Object.entries(secrets).forEach(([key, value]) => {
        const placeholder = `\${${key}}`;
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        injectedContent = injectedContent.replace(regex, value);
    });

    return injectedContent;
}

/**
 * Generates a preview of secret injection showing original and injected content
 */
export function generateSecretInjectionPreview(
    composeContent: string,
    availableSecrets: Record<string, string>
): SecretInjectionPreview {
    const placeholdersFound = findSecretPlaceholders(composeContent);
    const missingSecrets = placeholdersFound.filter(placeholder =>
        !availableSecrets.hasOwnProperty(placeholder)
    );

    const injectedCompose = injectSecrets(composeContent, availableSecrets);

    return {
        original_compose: composeContent,
        injected_compose: injectedCompose,
        placeholders_found: placeholdersFound,
        missing_secrets: missingSecrets
    };
}

/**
 * Validates that all secret placeholders have corresponding secrets
 */
export function validateSecretPlaceholders(
    composeContent: string,
    availableSecrets: Record<string, string>
): { valid: boolean; missingSecrets: string[] } {
    const placeholdersFound = findSecretPlaceholders(composeContent);
    const missingSecrets = placeholdersFound.filter(placeholder =>
        !availableSecrets.hasOwnProperty(placeholder)
    );

    return {
        valid: missingSecrets.length === 0,
        missingSecrets
    };
}

/**
 * Escapes secret values for safe injection into Docker Compose files
 * Handles special characters that might break YAML parsing
 */
export function escapeSecretValue(value: string): string {
    // If the value contains special characters, wrap it in quotes
    if (/["\s#:{}[\],&*!|>'%@`]/.test(value)) {
        // Escape any existing quotes and wrap in double quotes
        return `"${value.replace(/"/g, '\\"')}"`;
    }

    return value;
}

/**
 * Creates a template from a Docker Compose file by replacing values with placeholders
 * This is useful for creating reusable templates from existing configurations
 */
export function createTemplateFromCompose(
    composeContent: string,
    secretMappings: Record<string, string>
): string {
    let templateContent = composeContent;

    // Replace secret values with placeholders
    Object.entries(secretMappings).forEach(([secretKey, secretValue]) => {
        const placeholder = `\${${secretKey}}`;
        // Escape special regex characters in the secret value
        const escapedValue = secretValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedValue, 'g');
        templateContent = templateContent.replace(regex, placeholder);
    });

    return templateContent;
}

/**
 * Extracts potential secret values from a Docker Compose file
 * Identifies values that look like they should be secrets (passwords, keys, tokens, etc.)
 */
export function extractPotentialSecrets(composeContent: string): Array<{
    key: string;
    value: string;
    line: number;
    context: string;
}> {
    const lines = composeContent.split('\n');
    const potentialSecrets: Array<{
        key: string;
        value: string;
        line: number;
        context: string;
    }> = [];

    // Patterns that indicate a value might be a secret
    const secretPatterns = [
        /password/i,
        /secret/i,
        /key/i,
        /token/i,
        /auth/i,
        /credential/i,
        /api_key/i,
        /private_key/i,
        /access_key/i,
        /database_url/i
    ];

    lines.forEach((line, index) => {
        // Look for environment variable assignments
        const envMatch = line.match(/^\s*-?\s*([A-Z_][A-Z0-9_]*)\s*[:=]\s*(.+)$/);
        if (envMatch) {
            const [, key, value] = envMatch;

            // Check if the key matches secret patterns
            const isLikelySecret = secretPatterns.some(pattern => pattern.test(key));

            // Also check if the value looks like a secret (long, complex strings)
            const valueIsComplex = value.length > 10 && /[A-Za-z0-9+/=]/.test(value);

            if (isLikelySecret || valueIsComplex) {
                potentialSecrets.push({
                    key,
                    value: value.replace(/^["']|["']$/g, ''), // Remove quotes
                    line: index + 1,
                    context: line.trim()
                });
            }
        }
    });

    return potentialSecrets;
}

/**
 * Generates environment variable format from secrets
 * Useful for creating .env files from secret configurations
 */
export function generateEnvFormat(secrets: Record<string, string>): string {
    return Object.entries(secrets)
        .map(([key, value]) => `${key}=${escapeSecretValue(value)}`)
        .join('\n');
}

/**
 * Parses environment variable format into secrets object
 * Supports both KEY=value and KEY="value" formats
 */
export function parseEnvFormat(envContent: string): Record<string, string> {
    const secrets: Record<string, string> = {};
    const lines = envContent.split('\n');

    lines.forEach(line => {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        // Parse KEY=value format
        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (match) {
            const [, key, value] = match;
            // Remove surrounding quotes if present
            const cleanValue = value.replace(/^["']|["']$/g, '');
            secrets[key] = cleanValue;
        }
    });

    return secrets;
}