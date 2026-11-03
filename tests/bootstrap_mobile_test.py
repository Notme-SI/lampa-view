import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('bootstrap', Path(__file__).resolve().parents[1] / 'server/install-bootstrap.py')
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)

class MobileBootstrap(unittest.TestCase):
    def test_mobile_meta_is_early_idempotent_and_reversible(self):
        original = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="apple-mobile-web-app-status-bar-style" content="black"></head></html>'
        patched = bootstrap.patch_html(original, 'qa')
        self.assertEqual(bootstrap.patch_html(patched, 'qa'), patched)
        self.assertEqual(patched.count('name="viewport"'), 1)
        self.assertIn('viewport-fit=cover', patched)
        self.assertIn('black-translucent', patched)
        self.assertLess(patched.index('black-translucent'), patched.index('<script'))
        self.assertEqual(bootstrap.remove_html(patched), original)
    def test_missing_viewport_and_legacy_block(self):
        original = '<html><head><!-- lampa-minimal:start --><script src="old.js"></script><!-- lampa-minimal:end --></head></html>'
        patched = bootstrap.patch_html(original, 'qa')
        self.assertIn('viewport-fit=cover', patched)
        self.assertEqual(bootstrap.patch_html(patched, 'qa'), patched)
        self.assertNotIn('name="viewport"', bootstrap.remove_html(patched))

if __name__ == '__main__':
    unittest.main()
