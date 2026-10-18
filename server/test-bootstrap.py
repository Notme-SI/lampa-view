import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('install-bootstrap.py')
spec = importlib.util.spec_from_file_location('bootstrap', SCRIPT)
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)
HTML = '<html lang="en"><head><title>Lampa - Каталог</title><meta name="keep" content="yes"></head><body><div class="welcome"></div><script src="app.min.js?v=123"></script></body></html>'


class BootstrapTests(unittest.TestCase):
    def test_removes_conflicting_early_favicons(self):
        html = HTML.replace('</head>', '<link rel="icon" href="old.png"><link rel="shortcut icon" href="old.ico"><link rel="mask-icon" href="old.svg"></head>')
        updated = bootstrap.patch_html(html, 'abc')
        self.assertNotIn('href="old.', updated)
        self.assertEqual(updated.count('rel="icon"'), 2)
        self.assertIn('lampa.ico', updated)

    def test_preserves_native_assets_and_is_idempotent(self):
        updated = bootstrap.patch_html(HTML, 'abc')
        self.assertIn('<title>L A M P A</title>', updated)
        self.assertIn('lang="ru"', updated)
        self.assertIn('app.min.js?v=123', updated)
        self.assertIn('name="keep"', updated)
        self.assertEqual(bootstrap.patch_html(updated, 'abc'), updated)
        self.assertEqual(updated.count('lampa-minimal.boot.js'), 1)
        self.assertIn('v=xyz', bootstrap.patch_html(updated, 'xyz'))

    def test_removes_legacy_inline_style_only(self):
        html = HTML.replace('</head>', '<style id="lampa-minimal-boot">old</style><style>native</style></head>')
        updated = bootstrap.patch_html(html, 'abc')
        self.assertNotIn('>old</style>', updated)
        self.assertIn('<style>native</style>', updated)

    def test_restores_after_replacement_and_does_not_rewrite_unchanged_file(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'wwwroot/lampa-main'
            root.mkdir(parents=True)
            plugins = root.parent / 'plugins'
            plugins.mkdir()
            (plugins / 'lampa-minimal.boot.js').write_text('bootstrap')
            (plugins / 'lampa-minimal.svg').write_text('<svg/>')
            index = root / 'index.html'
            backups = Path(temp) / 'backups'
            command = [sys.executable, str(SCRIPT), '--root', str(root), '--backup-dir', str(backups)]
            index.write_text(HTML, encoding='utf-8')
            subprocess.run(command, check=True, capture_output=True)
            first = index.read_text(encoding='utf-8')
            modified = index.stat().st_mtime_ns
            subprocess.run(command, check=True, capture_output=True)
            self.assertEqual(index.stat().st_mtime_ns, modified)
            self.assertEqual(len(list(backups.iterdir())), 1)
            index.write_text(HTML.replace('v=123', 'v=456'), encoding='utf-8')
            subprocess.run(command, check=True, capture_output=True)
            self.assertIn('v=456', index.read_text(encoding='utf-8'))
            self.assertIn('lampa-minimal.boot.js', index.read_text(encoding='utf-8'))
            self.assertEqual(len(list(backups.iterdir())), 2)
            self.assertEqual(first.count('lampa-minimal:start'), 1)

    def test_incomplete_html_is_not_overwritten(self):
        with self.assertRaises(ValueError):
            bootstrap.patch_html('<html><head>', 'abc')

    def test_removal_preserves_native_index_and_assets(self):
        updated = bootstrap.remove_html(bootstrap.patch_html(HTML, 'abc'))
        self.assertNotIn('lampa-minimal.boot.js', updated)
        self.assertIn('app.min.js?v=123', updated)
        self.assertIn('name="keep"', updated)
        self.assertEqual(bootstrap.remove_html(updated), updated)

    def test_recovers_assets_if_the_whole_webroot_was_replaced(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'wwwroot/lampa-main'
            root.mkdir(parents=True)
            (root / 'index.html').write_text(HTML, encoding='utf-8')
            saved = Path(temp) / 'lib'
            saved.mkdir()
            shutil.copyfile(SCRIPT, saved / SCRIPT.name)
            for name in ['lampa-minimal.boot.js', 'lampa-minimal.svg', 'lampa.js']:
                (saved / name).write_text('saved asset')
            subprocess.run([sys.executable, str(saved / SCRIPT.name), '--root', str(root), '--backup-dir', str(Path(temp) / 'backups')], check=True, capture_output=True)
            self.assertIn('lampa-minimal.boot.js', (root / 'index.html').read_text(encoding='utf-8'))
            for name in ['lampa-minimal.boot.js', 'lampa-minimal.svg', 'lampa.js']:
                self.assertEqual((root.parent / 'plugins' / name).read_text(), 'saved asset')


if __name__ == '__main__':
    unittest.main()
