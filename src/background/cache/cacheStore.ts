import { PolicyOutcome, TLDRResult } from "../../shared/contracts";

interface TimedValue<T> {
  value: T;
  expiresAt: number;
  touchedAt: number;
}

export class CacheStore {
  private decisionKey = "fbclean.cache.decision";
  private tldrKey = "fbclean.cache.tldr";

  async getDecision(key: string): Promise<PolicyOutcome | null> {
    return this.getValue<PolicyOutcome>(this.decisionKey, key);
  }

  async putDecision(key: string, value: PolicyOutcome, ttlMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.putValue(this.decisionKey, key, value, ttlMs);
  }

  async getTLDR(key: string): Promise<TLDRResult | null> {
    return this.getValue<TLDRResult>(this.tldrKey, key);
  }

  async putTLDR(key: string, value: TLDRResult, ttlMs = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.putValue(this.tldrKey, key, value, ttlMs);
  }

  private async getValue<T>(bucketKey: string, key: string): Promise<T | null> {
    const record = await chrome.storage.local.get(bucketKey);
    const bucket = (record[bucketKey] ?? {}) as Record<string, TimedValue<T>>;
    const entry = bucket[key];
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      delete bucket[key];
      await chrome.storage.local.set({ [bucketKey]: bucket });
      return null;
    }

    entry.touchedAt = Date.now();
    await chrome.storage.local.set({ [bucketKey]: bucket });
    return entry.value;
  }

  private async putValue<T>(bucketKey: string, key: string, value: T, ttlMs: number): Promise<void> {
    const record = await chrome.storage.local.get(bucketKey);
    const bucket = (record[bucketKey] ?? {}) as Record<string, TimedValue<T>>;
    bucket[key] = { value, expiresAt: Date.now() + ttlMs, touchedAt: Date.now() };
    await chrome.storage.local.set({ [bucketKey]: bucket });
  }
}
