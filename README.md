# FeedSense (Chrome MV3 extension)

FeedSense — расширение для Chrome (MV3), которое анализирует юниты ленты Facebook и применяет действие по детерминированным правилам из настроек: оставить, скрыть, свернуть или подготовить TL;DR-режим.

## Что реализовано по контрактам

- Контракты сигналов, настроек и ответов фона (`PostSignals`, `SettingsV1`, `PolicyOutcome`) используются как источник истины.  
- В content-script реализованы:
  - поиск ленты и постов,
  - извлечение текста и маркеров (sponsored/suggested/reels),
  - пакетная отправка в background,
  - применение решения к DOM.
- В background реализованы:
  - store настроек с дефолтной схемой,
  - policy-engine с rule-first классификацией,
  - кэш решений.

## Установка и запуск

### 1) Установить зависимости

```bash
npm install
```

### 2) Собрать расширение

```bash
npm run build
```

После сборки готовое расширение лежит в `dist/`.

### Debug-сборка

```bash
npm run build:debug
```

Debug-версия собирается в `dist-debug/` и показывает диагностическую панель внизу страницы.  
Также доступны хелперы в консоли страницы:

- `window.__feedsenseDebug.status()`
- `window.__feedsenseDebug.locateRoot()`
- `window.__feedsenseDebug.locateUnits()`
- `window.__feedsenseDebug.processNow()`

Примечание: в обычной `page console` Chrome content-script работает в isolated world, поэтому `window.__feedsenseDebug` может быть `undefined`.
Для page console используйте:

- `JSON.parse(document.getElementById("fbclean-debug-state")?.getAttribute("data-json") ?? "null")`
- `window.dispatchEvent(new CustomEvent("feedsense:processNow"))`

### 3) Установить в Chrome

1. Откройте `chrome://extensions`.
2. Включите **Developer mode**.
3. Нажмите **Load unpacked** и выберите папку `dist`.

## Проверка (тесты)

```bash
npm test
```

Покрыты базовые сценарии:
- правило `hideSponsored`,
- приоритет allowlist над blocklist,
- fallback в `REVIEW`,
- детекция маркеров в локализованном тексте.

## Полезные команды

- `npm run typecheck` — строгая проверка TypeScript.
- `npm run build` — сборка расширения для установки.
- `npm test` — запуск unit-тестов.
