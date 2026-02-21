export class ObserverController {
  private observer: MutationObserver | null = null;
  private timer: number | null = null;
  private readonly debounceMs = 120;
  private readonly observedAttributes = ["aria-label", "aria-description", "title", "data-tooltip-content", "href"];

  start(
    target: HTMLElement,
    onBatch: () => void,
    onMutations?: (records: MutationRecord[]) => void
  ): void {
    this.stop();
    this.observer = new MutationObserver((records) => {
      onMutations?.(records);
      if (this.timer) {
        window.clearTimeout(this.timer);
      }
      this.timer = window.setTimeout(() => onBatch(), this.debounceMs);
    });

    this.observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: this.observedAttributes
    });
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
