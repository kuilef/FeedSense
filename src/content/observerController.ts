export class ObserverController {
  private observer: MutationObserver | null = null;
  private timer: number | null = null;

  start(target: HTMLElement, onBatch: () => void): void {
    this.stop();
    this.observer = new MutationObserver(() => {
      if (this.timer) {
        window.clearTimeout(this.timer);
      }
      this.timer = window.setTimeout(() => onBatch(), 200);
    });

    this.observer.observe(target, { childList: true, subtree: true, characterData: true });
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
