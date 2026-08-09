import { auth, PRIMARY_AUTHORIZED_EMAIL } from './auth';

/**
 * Utility for making API requests with automatic exponential backoff retries.
 * Handles transient network issues, Cloud Run cold starts, and rate limits.
 * Automatically attaches authorization security headers.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
  retries = 2,
  delayMs = 600
): Promise<Response> {
  let lastError: any = null;

  // Prepare authorization headers
  const currentUserEmail = auth.currentUser?.email || (sessionStorage.getItem('master_pin_unlocked') === 'true' ? PRIMARY_AUTHORIZED_EMAIL : '');
  const isPinUnlocked = sessionStorage.getItem('master_pin_unlocked') === 'true' ? 'unlocked' : '';

  const headers = new Headers(options.headers || {});
  if (currentUserEmail) {
    headers.set('x-user-email', currentUserEmail);
  }
  if (isPinUnlocked) {
    headers.set('x-access-pin', isPinUnlocked);
  }

  const updatedOptions: RequestInit = {
    ...options,
    headers,
  };

  const timeoutDuration = options.timeoutMs || 180000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    try {
      const response = await fetch(url, {
        ...updatedOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        return response;
      }

      // Retry on 429 rate limit or 5xx server issues
      if (response.status === 429 || response.status >= 500) {
        const errorText = await response.clone().text().catch(() => '');
        lastError = new Error(`Server status ${response.status}: ${errorText || response.statusText}`);
      } else {
        return response;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error(`Request timeout on ${url}`);
      }
      console.warn(`[Network Retry] Attempt ${attempt + 1} for ${url} failed:`, err?.message || err);
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(1.5, attempt)));
    }
  }

  if (lastError) {
    throw lastError;
  }

  return fetch(url, updatedOptions);
}
