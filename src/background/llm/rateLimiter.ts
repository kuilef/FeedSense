export class RateLimiter {
  private timestamps: number[] = [];

  constructor(private readonly maxRequestsPerMinute: number) {}

  permits(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((ts) => now - ts < 60_000);
    if (this.timestamps.length >= this.maxRequestsPerMinute) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }
}
