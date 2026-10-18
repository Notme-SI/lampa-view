import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('installer', Path(__file__).with_name('install-online.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class DownloadTests(unittest.TestCase):
    def fixture(self, change=None):
        data = {name: ('verified ' + name).encode() for name in installer.FILES}
        manifest = {'files': {name: hashlib.sha256(value).hexdigest() for name, value in data.items()}}
        if change:
            change(manifest)
        urls = {installer.BASE + url: data[name] for name, url in installer.FILES.items()}
        urls[installer.BASE + 'install-manifest.json'] = json.dumps(manifest).encode()
        def opener(request, **options):
            return io.BytesIO(urls[request.full_url.split('?')[0]])
        return data, opener

    def test_downloads_only_expected_files_with_matching_hashes(self):
        data, opener = self.fixture()
        with tempfile.TemporaryDirectory() as directory:
            installer.download(directory, opener)
            for name, expected in data.items():
                self.assertEqual((Path(directory) / name).read_bytes(), expected)

    def test_bad_hash_never_writes_installer_files(self):
        _, opener = self.fixture(lambda m: m['files'].update({'dist/lampa.js': '0' * 64}))
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                installer.download(directory, opener)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_unexpected_path_is_rejected(self):
        _, opener = self.fixture(lambda m: m['files'].update({'../outside': '0' * 64}))
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, 'file list'):
                installer.download(directory, opener)


if __name__ == '__main__':
    unittest.main()
