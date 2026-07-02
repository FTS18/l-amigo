import { fetchWithTimeout } from './network';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  jitter: true,
};

/**
 * Wraps a standard fetch call with exponential backoff and retry logic.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit & { timeout?: number },
  options: RetryOptions = {}
): Promise<Response> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let currentDelay = config.initialDelayMs!;
  let attempt = 0;

  while (attempt <= config.maxRetries!) {
    try {
      const response = await fetchWithTimeout(url, init);
      
      // If the response is successful, or it's a client error (4xx) that shouldn't be retried
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }

      // If it's a 429 (Too Many Requests) or a 5xx error, we should retry.
      if (attempt === config.maxRetries!) {
        return response; // Return the failed response if we're out of retries
      }
      
      console.warn(`[fetchWithRetry] Request failed with status ${response.status}. Retrying in ${currentDelay}ms... (Attempt ${attempt + 1}/${config.maxRetries})`);
    } catch (error) {
      if (attempt === config.maxRetries!) {
        throw error;
      }
      console.warn(`[fetchWithRetry] Request threw an error: ${(error as Error).message}. Retrying in ${currentDelay}ms... (Attempt ${attempt + 1}/${config.maxRetries})`);
    }

    // Wait for the delay
    await new Promise((resolve) => setTimeout(resolve, currentDelay));

    // Calculate next delay with exponential backoff
    currentDelay = Math.min(currentDelay * config.backoffFactor!, config.maxDelayMs!);
    
    // Add jitter if enabled (randomize by +/- 20% to prevent thundering herds)
    if (config.jitter) {
      const jitterFactor = 0.8 + Math.random() * 0.4;
      currentDelay = Math.floor(currentDelay * jitterFactor);
    }
    
    attempt++;
  }
  
  throw new Error("fetchWithRetry exceeded max retries");
}
