import { useState, useEffect } from 'react';

export interface SWROptions {
  throttleMs?: number;
  skip?: boolean;
}

/**
 * A custom hook for Stale-While-Revalidate caching using chrome.storage.local
 * 
 * @param key The cache key to use in chrome.storage.local
 * @param fetcher A function that returns a Promise resolving to the fresh data
 * @param deps Dependency array that triggers a re-run of the hook (e.g. selected platforms changing)
 * @param options Configuration options including throttleMs and skip
 */
export function useSWRChromeStorage<T>(
  key: string,
  fetcher: () => Promise<T>,
  deps: any[] = [],
  options: SWROptions = {}
) {
  const throttleMs = options.throttleMs ?? 300000;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (options.skip) {
        setLoading(false);
        return;
      }

      // 1. Get from cache instantly
      const cached = await new Promise<any>(resolve => {
        chrome.storage.local.get([key], res => resolve(res[key]));
      });

      if (cached && cached.data) {
        if (active) {
          setData(cached.data);
          setLoading(false); // Instantly stop loading if we have cached data
        }
        
        // Check if we need to throttle the background revalidation
        if (cached.timestamp && Date.now() - cached.timestamp < throttleMs) {
          return; // Cache is still fresh enough, skip background fetch
        }
      } else {
        if (active) setLoading(true); // Only set loading true if we have no cache
      }

      // 2. Background Revalidation (Stale-While-Revalidate)
      try {
        const newData = await fetcher();
        if (active) {
          setData(newData);
          setLoading(false);
        }
        
        // Overwrite cache with new data and timestamp
        chrome.storage.local.set({
          [key]: {
            data: newData,
            timestamp: Date.now()
          }
        });
      } catch (err) {
        console.error("SWR Fetch Error for key", key, err);
        if (active && !cached) {
          setLoading(false);
        }
      }
    };

    run();

    // Listen for background updates to this cache key from other windows/views
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes[key] && active) {
        const newValue = changes[key].newValue;
        if (newValue && newValue.data) {
          setData(newValue.data);
          setLoading(false);
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => { 
      active = false; 
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, deps); // Re-run when dependencies change

  return { data, loading, mutate: setData };
}
