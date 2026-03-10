import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase


class MinerApiTests(TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.vocab_path = Path(self.temp_dir.name) / "vocab.txt"

        # Ensure each test uses isolated vocab storage instead of project file.
        self.vocab_patch = patch("miner_api.views.VOCAB_FILE", self.vocab_path)
        self.vocab_patch.start()

    def tearDown(self) -> None:
        self.vocab_patch.stop()
        self.temp_dir.cleanup()

    def test_get_vocab_creates_file_and_returns_empty_list(self):
        response = self.client.get("/api/vocab")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["vocab_text"], "")
        self.assertEqual(data["words"], [])
        self.assertTrue(self.vocab_path.exists())

    def test_update_vocab_with_text(self):
        payload = {"vocab_text": "我 你 他"}
        response = self.client.post(
            "/api/vocab/update",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["words"], ["我", "你", "他"])
        self.assertEqual(self.vocab_path.read_text(encoding="utf-8"), "我 你 他")

    def test_update_vocab_with_words_array(self):
        payload = {"words": ["你好", "世界"]}
        response = self.client.put(
            "/api/vocab/update",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["vocab_text"], "你好 世界")
        self.assertEqual(data["words"], ["你好", "世界"])

    def test_update_vocab_rejects_invalid_payload(self):
        response = self.client.post(
            "/api/vocab/update",
            data=json.dumps({"vocab_text": 123}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_analyze_text_success_with_inline_vocab(self):
        payload = {"text": "我喜欢你你", "vocab_text": "我 你"}
        response = self.client.post(
            "/api/analyze",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data["known_percentage"], 0)
        self.assertIn("words", data)
        self.assertIn("unknown_words", data)
        self.assertGreater(len(data["words"]), 0)

    def test_analyze_text_rejects_non_string_text(self):
        response = self.client.post(
            "/api/analyze",
            data=json.dumps({"text": ["bad"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_analyze_text_uses_saved_vocab_when_not_provided(self):
        self.client.post(
            "/api/vocab/update",
            data=json.dumps({"vocab_text": "你好"}),
            content_type="application/json",
        )

        response = self.client.post(
            "/api/analyze",
            data=json.dumps({"text": "你好你好"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data["known_percentage"], 0)

    def test_analyze_file_success(self):
        upload = SimpleUploadedFile(
            "sample.txt",
            "你好世界".encode("utf-8"),
            content_type="text/plain",
        )
        response = self.client.post("/api/analyze-file", data={"file": upload, "vocab_text": "你好"})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["filename"], "sample.txt")
        self.assertIn("words", data)

    def test_analyze_file_requires_file(self):
        response = self.client.post("/api/analyze-file", data={})

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_analyze_file_rejects_non_utf8_file(self):
        upload = SimpleUploadedFile(
            "bad.txt",
            b"\xff\xfe\x00\x00",
            content_type="text/plain",
        )
        response = self.client.post("/api/analyze-file", data={"file": upload})

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())
