import json
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone

from miner_api.models import UserFlashcard, Word


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
        self.assertIn("priority_drill_set", data)
        self.assertGreater(len(data["words"]), 0)
        self.assertIsInstance(data["priority_drill_set"], list)
        if data["priority_drill_set"]:
            first_item = data["priority_drill_set"][0]
            self.assertIn("word", first_item)
            self.assertIn("info", first_item)

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

    def test_vocab_screen_groups_words_into_hsk_bands(self):
        response = self.client.post(
            "/api/vocab-screen",
            data=json.dumps({"text": "我喜欢你，你喜欢我"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("groups", data)
        self.assertEqual(len(data["groups"]), 9)
        self.assertGreater(data["total_unique_words"], 0)

    def test_vocab_screen_rejects_non_string_text(self):
        response = self.client.post(
            "/api/vocab-screen",
            data=json.dumps({"text": ["bad"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_vocab_screen_handles_empty_text(self):
        response = self.client.post(
            "/api/vocab-screen",
            data=json.dumps({"text": ""}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_unique_words"], 0)
        self.assertEqual(data["total_occurrences"], 0)
        self.assertEqual(len(data["groups"]), 9)

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

    def test_register_creates_account_and_logs_in(self):
        response = self.client.post(
            "/api/auth/register",
            data=json.dumps({"username": "alice", "password": "StrongPass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username="alice").exists())

    def test_create_flashcards_requires_authentication(self):
        response = self.client.post(
            "/api/flashcards/create",
            data=json.dumps({"words": [{"word": "你好", "pinyin": "ni3 hao3"}]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_create_flashcards_for_authenticated_user(self):
        user = User.objects.create_user(username="bob", password="TopSecret123")
        self.client.force_login(user)

        response = self.client.post(
            "/api/flashcards/create",
            data=json.dumps({
                "words": [
                    {"word": "你好", "pinyin": "ni3 hao3", "meaning": "hello"},
                    {"word": "世界", "pinyin": "shi4 jie4", "meaning": "world"},
                ]
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["created"], 2)
        self.assertEqual(UserFlashcard.objects.filter(user=user).count(), 2)
        self.assertEqual(Word.objects.count(), 2)

    def test_create_flashcards_saves_one_row_per_word(self):
        user = User.objects.create_user(username="cathy", password="TopSecret123")
        self.client.force_login(user)

        response = self.client.post(
            "/api/flashcards/create",
            data=json.dumps(
                {
                    "words": [
                        {
                            "word": "东西",
                            "pinyin": "dong1 xi",
                            "meanings": ["thing", "east and west"],
                        }
                    ]
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["created"], 1)
        self.assertEqual(UserFlashcard.objects.filter(user=user, word__text="东西").count(), 1)
        self.assertEqual(Word.objects.filter(text="东西").count(), 1)
        flashcard = UserFlashcard.objects.get(user=user, word__text="东西")
        self.assertEqual(flashcard.meaning, "thing; east and west")

    def test_create_flashcards_does_not_duplicate_existing_word_rows(self):
        user = User.objects.create_user(username="dora", password="TopSecret123")
        self.client.force_login(user)

        payload = {
            "words": [
                {
                    "word": "东西",
                    "pinyin": "dong1 xi",
                    "meanings": ["thing", "east and west"],
                }
            ]
        }

        first = self.client.post(
            "/api/flashcards/create",
            data=json.dumps(payload),
            content_type="application/json",
        )
        second = self.client.post(
            "/api/flashcards/create",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["created"], 1)
        self.assertEqual(second.json()["created"], 0)
        self.assertEqual(UserFlashcard.objects.filter(user=user, word__text="东西").count(), 1)
        self.assertEqual(Word.objects.filter(text="东西").count(), 1)

    def test_create_flashcards_merges_new_meanings_into_existing_word(self):
        user = User.objects.create_user(username="helen", password="TopSecret123")
        self.client.force_login(user)

        first = self.client.post(
            "/api/flashcards/create",
            data=json.dumps({"words": [{"word": "东西", "pinyin": "dong1 xi", "meaning": "thing"}]}),
            content_type="application/json",
        )
        second = self.client.post(
            "/api/flashcards/create",
            data=json.dumps({"words": [{"word": "东西", "pinyin": "dong1 xi", "meaning": "east and west"}]}),
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["created"], 1)
        self.assertEqual(second.json()["created"], 0)
        flashcard = UserFlashcard.objects.get(user=user, word__text="东西")
        self.assertEqual(flashcard.meaning, "thing; east and west")

    def test_flashcards_due_only_filters_future_cards(self):
        user = User.objects.create_user(username="erin", password="TopSecret123")
        self.client.force_login(user)

        due_word = Word.objects.create(text="你好", pinyin="ni3 hao3")
        later_word = Word.objects.create(text="再见", pinyin="zai4 jian4")
        UserFlashcard.objects.create(user=user, word=due_word, meaning="hello", due_at=timezone.now() - timedelta(minutes=1))
        UserFlashcard.objects.create(user=user, word=later_word, meaning="goodbye", due_at=timezone.now() + timedelta(days=1))

        response = self.client.get("/api/flashcards?due_only=1")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["due"], 1)
        self.assertTrue(data["due_only"])
        self.assertEqual(len(data["flashcards"]), 1)
        self.assertEqual(data["flashcards"][0]["word"], "你好")

    def test_review_flashcard_again_resets_card_to_learning(self):
        user = User.objects.create_user(username="frank", password="TopSecret123")
        self.client.force_login(user)

        word = Word.objects.create(text="你好", pinyin="ni3 hao3")
        flashcard = UserFlashcard.objects.create(
            user=user,
            word=word,
            meaning="hello",
            due_at=timezone.now() - timedelta(minutes=1),
            interval_days=6,
            ease_factor=2.5,
            consecutive_correct_reviews=3,
        )

        before_review = timezone.now()
        response = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "again"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        flashcard.refresh_from_db()
        self.assertEqual(flashcard.interval_days, 0)
        self.assertEqual(flashcard.consecutive_correct_reviews, 0)
        self.assertEqual(flashcard.lapse_count, 1)
        self.assertEqual(flashcard.review_count, 1)
        self.assertLess(flashcard.ease_factor, 2.5)
        self.assertGreaterEqual(flashcard.due_at, before_review + timedelta(minutes=9))

    def test_review_flashcard_good_graduates_new_card(self):
        user = User.objects.create_user(username="grace", password="TopSecret123")
        self.client.force_login(user)

        word = Word.objects.create(text="学习", pinyin="xue2 xi2")
        flashcard = UserFlashcard.objects.create(
            user=user,
            word=word,
            meaning="study",
            due_at=timezone.now() - timedelta(minutes=1),
        )

        before_review = timezone.now()
        response = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        flashcard.refresh_from_db()
        self.assertEqual(flashcard.interval_days, 1)
        self.assertEqual(flashcard.consecutive_correct_reviews, 1)
        self.assertEqual(flashcard.review_count, 1)
        self.assertEqual(flashcard.lapse_count, 0)
        self.assertAlmostEqual(flashcard.ease_factor, 2.5)
        self.assertGreaterEqual(flashcard.due_at, before_review + timedelta(hours=23))
