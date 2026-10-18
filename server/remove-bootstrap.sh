#!/bin/sh
set -eu
systemctl disable --now lampa-minimal-bootstrap.path
/usr/bin/python3 /usr/local/lib/lampa-minimal/install-bootstrap.py --remove
echo 'Early bootstrap disconnected. The regular Lampa plugin is managed in Lampa settings.'
