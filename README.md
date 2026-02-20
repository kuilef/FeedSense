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
