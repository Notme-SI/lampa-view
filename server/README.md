# Загрузочный экран

Установка и обновление на сервере Lampac:

```sh
curl -fsSL https://notme-si.github.io/lampa-view/install.sh | sudo sh
```

Нужны стандартная папка `/opt/lampac`, Linux, Python 3 и systemd. Старые файлы сохраняются в `/opt/lampac/plugin-backups`. Плагин подключается в расширениях Lampa по инструкции в основном README.

Отключить:

```sh
sudo sh /usr/local/lib/lampa-minimal/remove-bootstrap.sh
```
