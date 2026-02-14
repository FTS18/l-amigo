export interface RequestCacheEntry<T> {
  promise: Promise<T>;
  timestamp: number;
}

export class RequestCache {
  private cache = new Map<string, RequestCacheEntry<any>>();
  private readonly ttl: number;

  constructor(ttlMs: number = 5000) {
    this.ttl = ttlMs;
  }

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.cache.get(key);
    
    if (existing && Date.now() - existing.timestamp < this.ttl) {
      console.log(`[RequestCache] Using cached request for: ${key}`);
      return existing.promise;
    }

    const promise = fn().finally(() => {
      setTimeout(() => this.cache.delete(key), this.ttl);
    });

    this.cache.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp >= this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
}

export const profileCache = new RequestCache(10000);
export const submissionCache = new RequestCache(5000);
