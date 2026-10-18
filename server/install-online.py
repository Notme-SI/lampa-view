"""Download and verify the public installer, then run it on a standard Lampac server."""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import urllib.request

BASE = 'https://notme-si.github.io/lampa-view/'
FILES = {
    'dist/lampa.js': 'lampa.js',
    'dist/lampa-minimal.boot.js': 'lampa-minimal.boot.js',
    'dist/lampa-minimal.svg': 'lampa-minimal.svg',
    'dist/lampa.ico': 'lampa.ico',
    'server/install.sh': 'server/install.sh',
    'server/install-bootstrap.py': 'server/install-bootstrap.py',
    'server/remove-bootstrap.sh': 'server/remove-bootstrap.sh',
    'server/lampa-minimal-bootstrap.service': 'server/lampa-minimal-bootstrap.service',
    'server/lampa-minimal-bootstrap.path': 'server/lampa-minimal-bootstrap.path',
}


def download(destination, opener=urllib.request.urlopen):
    def read(url, limit):
        with opener(urllib.request.Request(url, headers={'User-Agent': 'Lampa-View-Installer'}), timeout=20) as response:
            content = response.read(limit + 1)
        if len(content) > limit:
            raise ValueError('Installer file exceeds size limit')
        return content

    manifest = json.loads(read(BASE + 'install-manifest.json', 32768))
    hashes = manifest.get('files', {})
    if set(hashes) != set(FILES):
        raise ValueError('Unexpected installer file list')
    verified = {}
    for name, url in FILES.items():
        expected = hashes[name]
        if not isinstance(expected, str) or not re.fullmatch('[a-f0-9]{64}', expected):
            raise ValueError('Invalid installer checksum')
        content = read(BASE + url + '?v=' + expected, 2 * 1024 * 1024)
        if hashlib.sha256(content).hexdigest() != expected:
            raise ValueError('Installer checksum mismatch; retry after a minute')
        verified[name] = content
    destination = Path(destination).resolve()
    for name, content in verified.items():
        path = destination / name
        if not path.resolve().is_relative_to(destination):
            raise ValueError('Installer path outside staging directory')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def main():
    if os.name != 'posix' or os.geteuid() != 0:
        raise SystemExit('Запустите команду установки с sudo на сервере Lampac.')
    if not Path('/opt/lampac/wwwroot/lampa-main/index.html').is_file():
        raise SystemExit('Не найдена стандартная установка Lampac в /opt/lampac.')
    if not Path('/run/systemd/system').is_dir() or not shutil.which('systemctl'):
        raise SystemExit('Для этой команды нужен сервер с systemd.')
    with tempfile.TemporaryDirectory(prefix='lampa-view-', dir='/tmp') as directory:
        download(directory)
        subprocess.run(['sh', str(Path(directory) / 'server/install.sh')], check=True)
    print('Загрузочный экран установлен. Перезапустите Lampa.')


if __name__ == '__main__':
    main()
