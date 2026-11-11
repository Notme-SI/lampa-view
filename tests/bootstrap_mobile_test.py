import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('bootstrap', Path(__file__).resolve().parents[1] / 'server/install-bootstrap.py')
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)

class MobileBootstrap(unittest.TestCase):
    def test_mobile_meta_is_early_idempotent_and_reversible(self):
        original = '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="apple-mobile-web-app-status-bar-style" content="black"><script src="app.js"></script></head></html>'
        patched = bootstrap.patch_html(original, 'qa')
        self.assertEqual(bootstrap.patch_html(patched, 'qa'), patched)
        self.assertEqual(patched.count('name="viewport"'), 1)
        self.assertIn('viewport-fit=cover', patched)
        self.assertIn('content="black-translucent"', patched)
        self.assertLess(patched.index('content="black-translucent"'), patched.index('<script'))
        self.assertEqual(patched.count('name="theme-color"'), 1)
        self.assertLess(patched.index('name="theme-color"'), patched.index('<script'))
        self.assertEqual(bootstrap.remove_html(patched), original)
    def test_missing_viewport_and_legacy_block(self):
        original = '<html><head><meta name="theme-color" content="#222"><!-- lampa-minimal:start --><script src="old.js"></script><!-- lampa-minimal:end --></head></html>'
        patched = bootstrap.patch_html(original, 'qa')
        self.assertIn('viewport-fit=cover', patched)
        self.assertEqual(bootstrap.patch_html(patched, 'qa'), patched)
        self.assertNotIn('name="viewport"', bootstrap.remove_html(patched))
        self.assertEqual(patched.count('name="theme-color"'), 1)
        self.assertIn('content="#222"', patched)

    def test_early_meta_keeps_host_head_indentation_on_repeated_updates(self):
        original = ('<html><head>\n<meta charset="utf-8">\n\n'
                    '    <meta http-equiv="X-UA-Compatible" content="IE=edge">\n'
                    '<meta name="viewport" content="width=device-width">\n'
                    '<script src="app.js"></script></head></html>')
        patched = bootstrap.patch_html(original, 'qa')
        self.assertEqual(bootstrap.patch_html(patched, 'qa'), patched)
        self.assertIn('\n\n    <meta http-equiv=', patched)

if __name__ == '__main__':
    unittest.main()
