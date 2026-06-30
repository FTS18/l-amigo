export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitorInterval?: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private readonly name: string;
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailTime = 0;
  private successCount = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly monitorInterval: number;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.monitorInterval = options.monitorInterval ?? 10000;
  }

  private async loadState(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const key = `cb_state_${this.name}`;
        const data = await chrome.storage.local.get(key);
        if (data[key]) {
          const val = data[key];
          this.state = val.state || CircuitState.CLOSED;
          this.failures = val.failures || 0;
          this.lastFailTime = val.lastFailTime || 0;
          this.successCount = val.successCount || 0;
        }
      } catch (e) {
        console.warn('[CircuitBreaker] Failed to load state', e);
      }
    }
  }

  private async saveState(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const key = `cb_state_${this.name}`;
        await chrome.storage.local.set({
          [key]: {
            state: this.state,
            failures: this.failures,
            lastFailTime: this.lastFailTime,
            successCount: this.successCount
          }
        });
      } catch (e) {
        console.warn('[CircuitBreaker] Failed to save state', e);
      }
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.loadState();
    if (this.isOpen()) {
      throw new Error(`Circuit breaker for ${this.name} is OPEN - service unavailable`);
    }

    try {
      const result = await fn();
      await this.onSuccess();
      return result;
    } catch (error) {
      await this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFail = Date.now() - this.lastFailTime;
      
      if (timeSinceLastFail >= this.resetTimeout) {
        console.log(`[CircuitBreaker] [${this.name}] Transitioning to HALF_OPEN`);
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        this.saveState();
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  private async onSuccess(): Promise<void> {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= 2) {
        console.log(`[CircuitBreaker] [${this.name}] Transitioning to CLOSED`);
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
    await this.saveState();
  }

  private async onFailure(): Promise<void> {
    this.failures++;
    this.lastFailTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      console.log(`[CircuitBreaker] [${this.name}] Transitioning to OPEN`);
      this.state = CircuitState.OPEN;
    }
    await this.saveState();
  }

  getState(): string {
    return this.state;
  }

  async reset(): Promise<void> {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
    this.lastFailTime = 0;
    await this.saveState();
  }
}
