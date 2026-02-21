# FeedSense LLM Extension Guide

Этот документ описывает LLM-часть расширения FeedSense (Chrome MV3) и точки расширения для интеграции реального провайдера.

## 1. Что это за расширение

FeedSense анализирует юниты ленты Facebook и принимает решение по каждому посту:

- `ALLOW` -> оставить;
- `HIDE` -> скрыть;
- `COLLAPSE` -> свернуть;
- `TLDR` -> заменить на краткую сводку;
- `REVIEW` -> неуверенный случай (fallback).

Сейчас основная логика работает детерминированно (по правилам), а LLM-слой заложен как каркас.

## 2. Текущий статус LLM

### Уже реализовано

- Контракты для LLM-режимов, лимитов, профиля промпта и результата классификации:
  - `src/shared/contracts.ts`
- Дефолтные LLM-настройки (model, mode, limits, promptProfile):
  - `src/background/settings/defaultSettings.ts`
- Каркас клиента LLM:
  - `src/background/llm/llmClient.ts`
- Локальный rate-limiter:
  - `src/background/llm/rateLimiter.ts`

### Пока не реализовано (заглушки)

- `LLMClient.classify(...)` всегда возвращает `REVIEW` с reason-кодом:
  - `LLM_DISABLED` (когда mode = `OFF`);
  - `LLM_NOT_IMPLEMENTED` (когда mode != `OFF`).
- В background-роутере TL;DR по запросу не генерируется:
  - `src/background/messageRouter.ts` -> `TLDR_NOT_IMPLEMENTED`.
- Policy engine пока не вызывает `LLMClient` и классифицирует только правилами:
  - `src/background/policy/policyEngine.ts`.

## 3. Поток данных (как должно работать)

1. Content script собирает `PostSignals` для каждого юнита.
2. Background получает `EVALUATE_BATCH`.
3. Rule-first логика обрабатывает явные правила (allow/block/маркеры/keywords).
4. Если правило не сработало и LLM включен:
   - проверяются лимиты (`maxRequestsPerMinute`, `maxCharsToSend`, `minTextLen`, `minExtractionConfidence`);
   - вызывается `LLMClient` для классификации;
   - результат маппится в `ActionDecision`.
5. Решение кэшируется по `canonicalHash + settingsVersion`.
6. Для `TLDR` (или по on-click) вызывается отдельный запрос генерации summary.

## 4. Ключевые контракты для LLM

- Вход: `PostSignals`
  - текст, source, markers, признаки sponsored/suggested/reel, confidence извлечения.
- Выход: `ClassificationResult`
  - `label`, `confidence`, `reasonCodes`, optional `summary`.
- Финальное действие: `PolicyOutcome.action`
  - `KEEP`, `HIDE`, `COLLAPSE`, `REPLACE_WITH_TLDR`.

Режимы LLM в настройках:

- `OFF` — LLM выключен;
- `BYOK` — пользовательский ключ API;
- `PAID` — managed endpoint/лицензия.

## 5. Где расширять код

Минимальный путь интеграции:

1. Реализовать провайдерный вызов в `src/background/llm/llmClient.ts`.
2. Подключить `RateLimiter` и pre-check лимитов.
3. В `DefaultPolicyEngine` добавить LLM fallback после deterministic rules.
4. Реализовать `REQUEST_TLDR` в `src/background/messageRouter.ts`.
5. Добавить UI для LLM-настроек (mode/provider/model/key) в `src/options/`.
6. Покрыть тестами:
   - лимиты и rate-limit;
   - fallback-поведение;
   - разбор и валидация ответа модели;
   - TLDR lazy-режимы.

## 6. Безопасность и приватность

- Не отправлять в модель лишние данные (только необходимые поля `PostSignals`).
- Учитывать `maxCharsToSend` и фильтровать PII при необходимости.
- Для `BYOK` хранить секреты в зашифрованном виде (`byok.apiKeyEncrypted`).
- Логирование LLM-ответов включать только в debug-режиме и без чувствительных данных.

## 7. Короткое резюме

FeedSense уже содержит полноценный контрактный каркас для LLM, но inference и TL;DR пока не подключены к реальному провайдеру. Этот файл фиксирует текущую архитектуру и минимальный план интеграции без изменения существующего поведения rule-first.
