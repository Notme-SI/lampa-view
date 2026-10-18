#!/bin/sh
set -eu
package=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test "$(id -u)" = 0 || { echo 'Run as root'; exit 1; }
test -f /opt/lampac/wwwroot/lampa-main/index.html
test -d /run/systemd/system
install -d /opt/lampac/wwwroot/plugins /usr/local/lib/lampa-minimal
backup="/opt/lampac/plugin-backups/package-$(date -u +%Y%m%d%H%M%S)"
install -d "$backup"
for name in lampa.js lampa-minimal.boot.js lampa-minimal.svg lampa.ico; do
    if [ -f "/opt/lampac/wwwroot/plugins/$name" ]; then cp -p "/opt/lampac/wwwroot/plugins/$name" "$backup/$name"; fi
done
for name in lampa.js lampa-minimal.boot.js lampa-minimal.svg lampa.ico; do
    source="$package/dist/$name"
    install -m 644 "$source" "/opt/lampac/wwwroot/plugins/$name.new"
    mv -f "/opt/lampac/wwwroot/plugins/$name.new" "/opt/lampac/wwwroot/plugins/$name"
done
for name in lampa.js lampa-minimal.boot.js lampa-minimal.svg lampa.ico; do
    install -m 644 "/opt/lampac/wwwroot/plugins/$name" "/usr/local/lib/lampa-minimal/$name"
done
install -m 644 "$package/server/install-bootstrap.py" /usr/local/lib/lampa-minimal/install-bootstrap.py
install -m 644 "$package/server/remove-bootstrap.sh" /usr/local/lib/lampa-minimal/remove-bootstrap.sh
install -m 644 "$package/server/lampa-minimal-bootstrap.service" /etc/systemd/system/lampa-minimal-bootstrap.service
install -m 644 "$package/server/lampa-minimal-bootstrap.path" /etc/systemd/system/lampa-minimal-bootstrap.path
systemctl daemon-reload
systemctl enable --now lampa-minimal-bootstrap.path
systemctl start lampa-minimal-bootstrap.service
printf 'Package backup: %s\n' "$backup"
