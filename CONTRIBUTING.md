# Разработка

Нужны Node.js 22+ и pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm test
python3 server/test-bootstrap.py
python3 server/test-online.py
```

`src/` — исходники; `vendor/` — адаптеры; `tests/` — проверки с реальным веб-клиентом Lampa в jsdom. `dist/` — серверный пакет; `docs/` — GitHub Pages. Сгенерированные файлы собираются из исходников. Используйте окончания строк LF.
