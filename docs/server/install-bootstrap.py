#!/usr/bin/env python3
"""Restore the plugin's early bootstrap after a Lampac web-client update."""
import argparse
import base64
import datetime
import hashlib
import os
from pathlib import Path
import re
import shutil
import tempfile


def restore_mobile_meta(match):
    saved = re.search(r'<!-- lampa-minimal:mobile ([A-Za-z0-9+/=]+) -->', match[0])
    return base64.b64decode(saved[1]).decode('utf-8') if saved else ''


def patch_html(text, revision):
    if '</head>' not in text.lower():
        raise ValueError('index.html has no closing head; leave it unchanged')
    text = re.sub(r'<style\b[^>]*\bid=["\']lampa-minimal-boot["\'][^>]*>.*?</style>\s*', '', text, flags=re.S | re.I)
    text = re.sub(r'<!-- lampa-minimal:start -->.*?<!-- lampa-minimal:end -->\s*', restore_mobile_meta, text, flags=re.S)
    # An old icon declared earlier can appear before the runtime branding loads.
    text = re.sub(r'<link\b[^>]*\brel\s*=\s*(["\'])(?:shortcut\s+icon|icon|mask-icon)\1[^>]*>\s*', '', text, flags=re.I)
    text = re.sub(r'<title>.*?</title>', '<title>L A M P A</title>', text, flags=re.S | re.I)
    text = re.sub(r'(<html\b[^>]*\blang=)(["\']).*?\2', lambda m: m[1] + m[2] + 'ru' + m[2], text, flags=re.I)
    mobile_pattern = r'<meta\b(?=[^>]*\bname\s*=\s*["\'](?:viewport|apple-mobile-web-app-capable|apple-mobile-web-app-status-bar-style)["\'])[^>]*>\s*'
    originals = re.findall(mobile_pattern, text, flags=re.I)
    text = re.sub(mobile_pattern, '', text, flags=re.I)
    viewport = next((tag for tag in originals if re.search(r'name\s*=\s*["\']viewport["\']', tag, re.I)), '')
    found = re.search(r'content\s*=\s*(["\'])(.*?)\1', viewport, re.I)
    options = found[2] if found else 'width=device-width, initial-scale=1'
    options = ', '.join([part.strip() for part in options.split(',') if part.strip() and not re.match(r'viewport-fit\s*=', part.strip(), re.I)] + ['viewport-fit=cover'])
    mobile = ('<!-- lampa-minimal:mobile ' + base64.b64encode(''.join(originals).encode('utf-8')).decode('ascii') + ' -->\n'
              '<meta name="viewport" content="' + options + '">\n'
              '<meta name="apple-mobile-web-app-capable" content="yes">\n'
              '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n')
    block = ('<!-- lampa-minimal:start -->\n' + mobile +
             '<link rel="icon" type="image/x-icon" href="/plugins/lampa.ico?v=' + revision + '">\n'
             '<link rel="icon" type="image/svg+xml" sizes="any" href="/plugins/lampa-minimal.svg?v=' + revision + '">\n'
             '<script src="/plugins/lampa-minimal.boot.js?v=' + revision + '"></script>\n'
             '<!-- lampa-minimal:end -->\n')
    return re.sub(r'</head>', lambda _: block + '</head>', text, count=1, flags=re.I)


def remove_html(text):
    text = re.sub(r'<!-- lampa-minimal:start -->.*?<!-- lampa-minimal:end -->\s*', restore_mobile_meta, text, flags=re.S)
    return text.replace('<title>L A M P A</title>', '<title>Lampa</title>')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/opt/lampac/wwwroot/lampa-main'))
    parser.add_argument('--backup-dir', type=Path, default=Path('/opt/lampac/plugin-backups'))
    parser.add_argument('--remove', action='store_true')
    args = parser.parse_args()
    path = args.root / 'index.html'
    boot = args.root.parent / 'plugins/lampa-minimal.boot.js'
    icon = args.root.parent / 'plugins/lampa-minimal.svg'
    if not path.is_file():
        print('Bootstrap inputs are not present yet; no changes')
        return
    if not args.remove:
        # Keep master copies outside Lampac, where its updater cannot replace them.
        for name in ['lampa-minimal.boot.js', 'lampa-minimal.svg', 'lampa.ico', 'lampa.js']:
            target = args.root.parent / 'plugins' / name
            saved = Path(__file__).parent / name
            if not target.exists() and saved.is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(saved, target)
                os.chmod(target, 0o644)
        if not boot.is_file() or not icon.is_file():
            print('Bootstrap assets are not present; no changes')
            return
    original = path.read_text(encoding='utf-8')
    if args.remove:
        patched = remove_html(original)
    else:
        revision = hashlib.sha256(boot.read_bytes() + icon.read_bytes()).hexdigest()[:12]
        patched = patch_html(original, revision)
    if patched == original:
        return
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S%f')
    backup = args.backup_dir / ('bootstrap-' + stamp)
    backup.mkdir(parents=True)
    shutil.copy2(path, backup / 'index.html')
    info = path.stat()
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, prefix='.lampa-minimal-', delete=False) as handle:
        handle.write(patched)
        temp = Path(handle.name)
    try:
        os.chmod(temp, info.st_mode)
        if hasattr(os, 'chown'):
            os.chown(temp, info.st_uid, info.st_gid)
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()
    print('Lampa bootstrap restored; backup: ' + str(backup))


if __name__ == '__main__':
    main()
