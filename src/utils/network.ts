/**
 * Safe fetch wrapper that automatically handles AbortController timeouts
 * and guarantees that clearTimeout is called immediately upon settlement
 * to prevent timer leaks in Manifest V3 Service Workers.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOpts } = options;
  const ctl = new AbortController();
  
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctl.abort();
      reject(new Error(`Timeout: Request to ${url} exceeded ${timeout}ms`));
    }, timeout);
  });

  try {
    const fetchPromise = fetch(url, { ...fetchOpts, signal: ctl.signal });
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    return res;
  } catch (err) {
    if (timer) clearTimeout(timer);
    throw err;
  }
}
