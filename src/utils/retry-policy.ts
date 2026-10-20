const TRANSIENT_CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08006',
]);

export class RetryPolicy {
  static async run<T>(
    operation: () => Promise<T>,
    options: {
      attempts?: number;
      baseDelayMs?: number;
      wait?: (milliseconds: number) => Promise<void>;
      random?: () => number;
    } = {},
  ): Promise<T> {
    const attempts = options.attempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 250;
    const wait = options.wait ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    const random = options.random ?? Math.random;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (!code || !TRANSIENT_CONNECTION_CODES.has(code) || attempt === attempts) {
          throw error;
        }
        const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
        await wait(exponentialDelay + Math.floor(random() * baseDelayMs));
      }
    }

    throw new Error('Retry operation exited unexpectedly');
  }
}
