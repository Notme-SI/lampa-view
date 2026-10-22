# Lampa View

Оформление Lampa с крупными баннерами, удобными карточками.

## Скриншоты

<a href="docs/screenshots/01-home.png"><img src="docs/screenshots/01-home.png" alt="Главная страница Lampa View" width="1200"></a>

<table>
  <tr>
    <td><a href="docs/screenshots/02-anime.png"><img src="docs/screenshots/02-anime.png" alt="Раздел аниме" width="600"></a><br>Аниме</td>
    <td><a href="docs/screenshots/03-catalogue.png"><img src="docs/screenshots/03-catalogue.png" alt="Каталог и меню навигации" width="600"></a><br>Каталог и навигация</td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/04-movie.png"><img src="docs/screenshots/04-movie.png" alt="Карточка фильма, актёры и комментарии" width="600"></a><br>Карточка фильма</td>
    <td><a href="docs/screenshots/05-anime-detail.png"><img src="docs/screenshots/05-anime-detail.png" alt="Карточка аниме и список серий" width="600"></a><br>Карточка аниме</td>
  </tr>
</table>

## Установить плагин

1. В Lampa откройте **Настройки → Расширения → Добавить плагин**.
2. Вставьте адрес и перезапустите Lampa:

```text
https://notme-si.github.io/lampa-view/lampa.js
```

Резерв качества Alloha работает через настроенный сервер онлайн-источников с включённым Alloha. Собственные ключи сторонних сервисов плагин не содержит.

## Установить загрузочный экран

Для своего сервера Lampac на Linux выполните одну команду:

```sh
curl -fsSL https://notme-si.github.io/lampa-view/install.sh | sudo sh
```

Готово. Поддерживается стандартная установка в `/opt/lampac` с systemd. Обновление — той же командой. [Как отключить](server/README.md).

## Плеер

Для Windows доступен [mpv+](https://github.com/Notme-SI/mpv-plus/releases/latest). В Lampa Desktop выберите внешний плеер `mpv.exe` из папки mpv+. Данные карточки передаются автоматически; отдельный мост устанавливать не нужно.

Для установленного тестового **mpv+ iOS 0.2** добавьте в расширения Lampa отдельный плагин:

```text
https://notme-si.github.io/lampa-view/mpvplus-ios.js
```

Он поддерживает Lampa, добавленную на домашний экран iPhone из Safari. Перезапустите Lampa и выберите **mpv+** в настройках плеера — он включится и для торрентов. Для торрентов также доступны пункты **Открыть в mpv+** и **Передать весь список в mpv+** в меню долгого нажатия на файл. Передаются выбранный файл, доступный плейлист, названия, качество и метаданные; переустановка iOS-приложения для этого плагина не нужна.

Сторонние плееры остаются в списках. Если mpv+ уже выбран для онлайна, при первом обновлении моста 0.2.2 он включится и вместо стандартного торрент-плеера; дальнейший ручной выбор сохраняется. Стартовых уведомлений нет. Закладка Safari не требуется. Скрипт передаёт данные локальной URL-схемой `mpvplus://`, не загружая плейлист на внешний сервер. Запуск через штатное окно файлов и длинное нажатие проверяется на нативном коде Lampa; переход в приложение и воспроизведение конкретного потока требуют проверки на устройстве. Код и проверки моста находятся в `plugins/mpvplus-ios.js` и `tests/mpvplus-ios*.test.cjs`; исходников нативного iOS-приложения в этом репозитории нет.

## Источники

- **Закусь TV / Автопилот** — [страница плагина](https://hub.alcopa.cc/hub/u/YXblJI9HT).
- **AGNative**, основа Закусь TV — [Llowmikee](https://github.com/Llowmikee), [appletv_agnative.js](https://llowmikee.github.io/AppleTVAGNativeNG/appletv_agnative.js).
- **Дизайн Potok** — [potok.rip](https://potok.rip/), [potok-media](https://github.com/potok-media).
- **Nova Plus** — [amikdn](https://github.com/amikdn/amikdn.github.io), [nova_plus.js](https://amikdn.github.io/nova_plus.js), [card_overlay.js](https://amikdn.github.io/card_overlay.js).
- **Nova Plus Community 1.0.0** — отдельные исправления из файла `nova-plus-community.js`, предоставленного пользователем.

[Изменения](CHANGELOG.md) · [Разработка](CONTRIBUTING.md) · [Источники и лицензии](THIRD-PARTY.md)
