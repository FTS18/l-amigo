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
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailTime = 0;
  private successCount = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly monitorInterval: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.monitorInterval = options.monitorInterval ?? 10000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is OPEN - service unavailable');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFail = Date.now() - this.lastFailTime;
      
      if (timeSinceLastFail >= this.resetTimeout) {
        console.log('[CircuitBreaker] Transitioning to HALF_OPEN');
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= 2) {
        console.log('[CircuitBreaker] Transitioning to CLOSED');
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      console.log('[CircuitBreaker] Transitioning to OPEN');
      this.state = CircuitState.OPEN;
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
    this.lastFailTime = 0;
  }
}
