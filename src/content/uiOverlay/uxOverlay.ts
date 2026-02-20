export class UXOverlay {
  attachPlaceholderControls(container: HTMLElement, onShowOriginal: () => void, onWhy: () => void): void {
    const wrap = document.createElement("div");
    wrap.className = "fbclean-controls";

    const showBtn = document.createElement("button");
    showBtn.textContent = "Показать оригинал";
    showBtn.addEventListener("click", onShowOriginal);

    const whyBtn = document.createElement("button");
    whyBtn.textContent = "Почему";
    whyBtn.addEventListener("click", onWhy);

    wrap.append(showBtn, whyBtn);
    container.prepend(wrap);
  }
}
