/**
 * Centralized API configuration for FirewallAI Dashboard
 * ============================================================
 * Single source of truth for backend URL and fetch helpers.
 * All components should import from here instead of re-declaring.
 */

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.1.101:3001';

interface FetchOptions extends RequestInit {
    timeout?: number;
}

/**
 * Centralized fetch wrapper with error handling, timeout, and typing
 */
export async function apiFetch<T = unknown>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { timeout = 10000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            ...fetchOptions,
        });

        if (!response.ok) {
            throw new Error(`API ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * POST request helper
 */
export async function apiPost<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    return apiFetch<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
