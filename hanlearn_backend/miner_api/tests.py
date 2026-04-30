import csv
import io
import json
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone

from miner_api import services
from miner_api.models import FlashcardReviewSubmission, UserFlashcard, Word


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

    @patch("miner_api.services._build_wordlist_info_lookup", return_value={})
    def test_analyze_text_priority_drill_set_falls_back_to_pycccedict(self, _mock_wordlist_lookup):
        response = self.client.post(
            "/api/analyze",
            data=json.dumps({"text": "学习", "vocab_text": ""}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        drill_set = response.json()["priority_drill_set"]
        self.assertGreater(len(drill_set), 0)
        first = drill_set[0]["info"]
        self.assertIn("meanings", first)
        self.assertIn("to learn", first["meanings"])

    @patch("miner_api.services._build_wordlist_info_lookup", return_value={})
    def test_resolve_word_flashcard_info_falls_back_to_pycccedict(self, _mock_wordlist_lookup):
        resolved = services.resolve_word_flashcard_info("学习")

        self.assertEqual(resolved["pinyin"], "xue2 xi2")
        self.assertIn("to learn", resolved["meanings"])

    @patch("miner_api.services._build_wordlist_info_lookup", return_value={})
    def test_resolve_word_flashcard_info_falls_back_to_pycccedict_for_ju_mang(self, _mock_wordlist_lookup):
        resolved = services.resolve_word_flashcard_info("巨蟒")

        self.assertEqual(resolved["pinyin"], "ju4 mang3")
        self.assertIn("python", resolved["meanings"])

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

    def test_login_rejects_invalid_credentials(self):
        User.objects.create_user(username="alice", password="StrongPass123")

        response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"username": "alice", "password": "WrongPass"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_login_authenticates_user_and_persists_session(self):
        User.objects.create_user(username="alice", password="StrongPass123")

        login_response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"username": "alice", "password": "StrongPass123"}),
            content_type="application/json",
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["is_authenticated"], True)

        me_response = self.client.get("/api/auth/me")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json()["is_authenticated"], True)
        self.assertEqual(me_response.json()["username"], "alice")

    def test_update_username_requires_authentication(self):
        response = self.client.post(
            "/api/auth/username",
            data=json.dumps({"new_username": "alice2", "current_password": "StrongPass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_update_username_changes_username_when_password_is_valid(self):
        user = User.objects.create_user(username="alice", password="StrongPass123")
        self.client.force_login(user)

        response = self.client.post(
            "/api/auth/username",
            data=json.dumps({"new_username": "alice_new", "current_password": "StrongPass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.username, "alice_new")

    def test_update_username_rejects_wrong_password(self):
        user = User.objects.create_user(username="alice", password="StrongPass123")
        self.client.force_login(user)

        response = self.client.post(
            "/api/auth/username",
            data=json.dumps({"new_username": "alice_new", "current_password": "WrongPass"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_update_password_requires_authentication(self):
        response = self.client.post(
            "/api/auth/password",
            data=json.dumps({"current_password": "OldPass123", "new_password": "NewPass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_update_password_changes_password_when_current_is_valid(self):
        user = User.objects.create_user(username="alice", password="OldPass123")
        self.client.force_login(user)

        response = self.client.post(
            "/api/auth/password",
            data=json.dumps({"current_password": "OldPass123", "new_password": "NewPass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("NewPass123"))

    def test_update_password_rejects_wrong_current_password(self):
        user = User.objects.create_user(username="alice", password="OldPass123")
        self.client.force_login(user)

        response = self.client.post(
            "/api/auth/password",
            data=json.dumps({"current_password": "WrongPass", "new_password": "NewPass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

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

    def test_export_flashcards_csv_requires_authentication(self):
        response = self.client.get("/api/flashcards/export")

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_export_flashcards_csv_returns_anki_compatible_rows(self):
        user = User.objects.create_user(username="exporter", password="TopSecret123")
        other_user = User.objects.create_user(username="other", password="TopSecret123")
        self.client.force_login(user)

        nihao = Word.objects.create(text="你好", pinyin="ni3 hao3")
        zaijian = Word.objects.create(text="再见", pinyin="")
        xiexie = Word.objects.create(text="谢谢", pinyin="xie4 xie")

        UserFlashcard.objects.create(user=user, word=nihao, meaning="hello")
        UserFlashcard.objects.create(user=user, word=zaijian, meaning="goodbye")
        UserFlashcard.objects.create(user=user, word=xiexie, meaning="thank you")
        UserFlashcard.objects.create(user=other_user, word=Word.objects.create(text="苹果", pinyin="ping2 guo3"), meaning="apple")

        response = self.client.get("/api/flashcards/export")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("attachment; filename=\"hanlearn-flashcards.csv\"", response["Content-Disposition"])

        content = response.content.decode("utf-8")
        parsed_rows = list(csv.reader(io.StringIO(content)))

        self.assertEqual(parsed_rows[0], ["Front", "Back"])
        self.assertEqual(len(parsed_rows), 4)

        exported = {(front, back) for front, back in parsed_rows[1:]}
        self.assertIn(("你好", "ni3 hao3\nhello"), exported)
        self.assertIn(("再见", "goodbye"), exported)
        self.assertIn(("谢谢", "xie4 xie\nthank you"), exported)

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
        self.assertGreaterEqual(flashcard.due_at, before_review)
        self.assertLessEqual(flashcard.due_at, before_review + timedelta(seconds=5))

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

    def test_review_flashcard_idempotency_key_prevents_double_sm2_mutation(self):
        user = User.objects.create_user(username="idempotent", password="TopSecret123")
        self.client.force_login(user)

        word = Word.objects.create(text="阅读", pinyin="yue4 du2")
        flashcard = UserFlashcard.objects.create(
            user=user,
            word=word,
            meaning="to read",
            due_at=timezone.now() - timedelta(minutes=1),
        )

        first_response = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good", "idempotency_key": "k-review-1"}),
            content_type="application/json",
        )
        second_response = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good", "idempotency_key": "k-review-1"}),
            content_type="application/json",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertFalse(first_response.json()["idempotency_replayed"])
        self.assertTrue(second_response.json()["idempotency_replayed"])

        flashcard.refresh_from_db()
        self.assertEqual(flashcard.review_count, 1)
        self.assertEqual(flashcard.consecutive_correct_reviews, 1)
        self.assertEqual(
            FlashcardReviewSubmission.objects.filter(user=user, idempotency_key="k-review-1").count(),
            1,
        )
        submission = FlashcardReviewSubmission.objects.get(user=user, idempotency_key="k-review-1")
        flashcard_payload = submission.response_payload["flashcard"]
        self.assertIsInstance(flashcard_payload["created_at"], str)
        self.assertIsInstance(flashcard_payload["due_at"], str)

    def test_review_flashcard_idempotency_key_rejects_rating_mismatch(self):
        user = User.objects.create_user(username="idempotent2", password="TopSecret123")
        self.client.force_login(user)

        word = Word.objects.create(text="复习", pinyin="fu4 xi2")
        flashcard = UserFlashcard.objects.create(
            user=user,
            word=word,
            meaning="review",
            due_at=timezone.now() - timedelta(minutes=1),
        )

        first_response = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good", "idempotency_key": "k-review-2"}),
            content_type="application/json",
        )
        second_response = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "easy", "idempotency_key": "k-review-2"}),
            content_type="application/json",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 409)

        flashcard.refresh_from_db()
        self.assertEqual(flashcard.review_count, 1)

    def test_review_flashcard_rejects_missing_or_invalid_rating(self):
        user = User.objects.create_user(username="ratingcheck", password="TopSecret123")
        self.client.force_login(user)

        flashcard = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="苹果", pinyin="ping2 guo3"),
            meaning="apple",
            due_at=timezone.now() - timedelta(minutes=1),
        )

        missing_rating = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({}),
            content_type="application/json",
        )
        numeric_rating = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": 3}),
            content_type="application/json",
        )
        unknown_rating = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "perfect"}),
            content_type="application/json",
        )

        self.assertEqual(missing_rating.status_code, 400)
        self.assertEqual(numeric_rating.status_code, 400)
        self.assertEqual(unknown_rating.status_code, 400)

    def test_review_flashcard_requires_authentication_and_ownership(self):
        owner = User.objects.create_user(username="owner", password="TopSecret123")
        intruder = User.objects.create_user(username="intruder", password="TopSecret123")
        flashcard = UserFlashcard.objects.create(
            user=owner,
            word=Word.objects.create(text="老师", pinyin="lao3 shi1"),
            meaning="teacher",
            due_at=timezone.now() - timedelta(minutes=1),
        )

        unauthenticated = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good"}),
            content_type="application/json",
        )
        self.assertEqual(unauthenticated.status_code, 401)

        self.client.force_login(intruder)
        wrong_owner = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good"}),
            content_type="application/json",
        )
        missing_card = self.client.post(
            "/api/flashcards/999999/review",
            data=json.dumps({"rating": "good"}),
            content_type="application/json",
        )

        self.assertEqual(wrong_owner.status_code, 404)
        self.assertEqual(missing_card.status_code, 404)

    def test_review_flashcard_validates_idempotency_key_shape(self):
        user = User.objects.create_user(username="keyshape", password="TopSecret123")
        self.client.force_login(user)

        flashcard = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="医生", pinyin="yi1 sheng1"),
            meaning="doctor",
            due_at=timezone.now() - timedelta(minutes=1),
        )

        non_string = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good", "idempotency_key": 123}),
            content_type="application/json",
        )
        empty_string = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good", "idempotency_key": "   "}),
            content_type="application/json",
        )
        too_long = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good", "idempotency_key": "k" * 129}),
            content_type="application/json",
        )

        self.assertEqual(non_string.status_code, 400)
        self.assertEqual(empty_string.status_code, 400)
        self.assertEqual(too_long.status_code, 400)

    def test_review_flashcard_idempotency_key_rejects_flashcard_mismatch(self):
        user = User.objects.create_user(username="idmismatch", password="TopSecret123")
        self.client.force_login(user)

        first = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="今天", pinyin="jin1 tian1"),
            meaning="today",
            due_at=timezone.now() - timedelta(minutes=1),
        )
        second = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="明天", pinyin="ming2 tian1"),
            meaning="tomorrow",
            due_at=timezone.now() - timedelta(minutes=1),
        )

        first_response = self.client.post(
            f"/api/flashcards/{first.id}/review",
            data=json.dumps({"rating": "good", "idempotency_key": "k-shared"}),
            content_type="application/json",
        )
        second_response = self.client.post(
            f"/api/flashcards/{second.id}/review",
            data=json.dumps({"rating": "good", "idempotency_key": "k-shared"}),
            content_type="application/json",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 409)

    def test_review_flashcard_hard_and_easy_branch_updates(self):
        user = User.objects.create_user(username="branches", password="TopSecret123")
        self.client.force_login(user)

        hard_card = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="写", pinyin="xie3"),
            meaning="write",
            due_at=timezone.now() - timedelta(minutes=1),
            interval_days=1,
            ease_factor=2.5,
            consecutive_correct_reviews=1,
        )
        easy_card = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="读", pinyin="du2"),
            meaning="read",
            due_at=timezone.now() - timedelta(minutes=1),
            interval_days=0,
            ease_factor=2.5,
            consecutive_correct_reviews=0,
        )

        hard_response = self.client.post(
            f"/api/flashcards/{hard_card.id}/review",
            data=json.dumps({"rating": "hard"}),
            content_type="application/json",
        )
        easy_response = self.client.post(
            f"/api/flashcards/{easy_card.id}/review",
            data=json.dumps({"rating": "easy"}),
            content_type="application/json",
        )

        self.assertEqual(hard_response.status_code, 200)
        self.assertEqual(easy_response.status_code, 200)

        hard_card.refresh_from_db()
        easy_card.refresh_from_db()
        self.assertEqual(hard_card.interval_days, 2)
        self.assertAlmostEqual(hard_card.ease_factor, 2.35)
        self.assertEqual(easy_card.interval_days, 3)
        self.assertAlmostEqual(easy_card.ease_factor, 2.65)

    def test_review_flashcard_mature_interval_uses_half_up_rounding(self):
        user = User.objects.create_user(username="rounding", password="TopSecret123")
        self.client.force_login(user)

        flashcard = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="时间", pinyin="shi2 jian1"),
            meaning="time",
            due_at=timezone.now() - timedelta(minutes=1),
            interval_days=3,
            ease_factor=1.5,
            consecutive_correct_reviews=2,
        )

        response = self.client.post(
            f"/api/flashcards/{flashcard.id}/review",
            data=json.dumps({"rating": "good"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        flashcard.refresh_from_db()
        self.assertEqual(flashcard.interval_days, 5)
        self.assertEqual(flashcard.consecutive_correct_reviews, 3)

    def test_review_flashcard_clamps_ease_factor_bounds(self):
        user = User.objects.create_user(username="clamps", password="TopSecret123")
        self.client.force_login(user)

        low_ease_card = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="下雨", pinyin="xia4 yu3"),
            meaning="rain",
            due_at=timezone.now() - timedelta(minutes=1),
            interval_days=6,
            ease_factor=1.31,
            consecutive_correct_reviews=3,
        )
        high_ease_card = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="晴天", pinyin="qing2 tian1"),
            meaning="sunny day",
            due_at=timezone.now() - timedelta(minutes=1),
            interval_days=6,
            ease_factor=2.95,
            consecutive_correct_reviews=3,
        )

        low_response = self.client.post(
            f"/api/flashcards/{low_ease_card.id}/review",
            data=json.dumps({"rating": "again"}),
            content_type="application/json",
        )
        high_response = self.client.post(
            f"/api/flashcards/{high_ease_card.id}/review",
            data=json.dumps({"rating": "easy"}),
            content_type="application/json",
        )

        self.assertEqual(low_response.status_code, 200)
        self.assertEqual(high_response.status_code, 200)

        low_ease_card.refresh_from_db()
        high_ease_card.refresh_from_db()
        self.assertAlmostEqual(low_ease_card.ease_factor, 1.3)
        self.assertAlmostEqual(high_ease_card.ease_factor, 3.0)

    def test_review_flashcard_due_remaining_reflects_post_review_state(self):
        user = User.objects.create_user(username="dueremaining", password="TopSecret123")
        self.client.force_login(user)

        target = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="学校", pinyin="xue2 xiao4"),
            meaning="school",
            due_at=timezone.now() - timedelta(minutes=2),
        )
        UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="学生", pinyin="xue2 sheng1"),
            meaning="student",
            due_at=timezone.now() - timedelta(minutes=1),
        )
        UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="老师们", pinyin="lao3 shi1 men"),
            meaning="teachers",
            due_at=timezone.now() + timedelta(days=1),
        )

        response = self.client.post(
            f"/api/flashcards/{target.id}/review",
            data=json.dumps({"rating": "good"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["due_remaining"], 1)

    def test_bulk_delete_flashcards_deletes_only_owned_ids(self):
        user = User.objects.create_user(username="bulkdeleter", password="TopSecret123")
        other_user = User.objects.create_user(username="bulkother", password="TopSecret123")
        self.client.force_login(user)

        card_one = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="一个", pinyin="yi1 ge4"),
            meaning="one",
        )
        card_two = UserFlashcard.objects.create(
            user=user,
            word=Word.objects.create(text="两个", pinyin="liang3 ge4"),
            meaning="two",
        )
        other_card = UserFlashcard.objects.create(
            user=other_user,
            word=Word.objects.create(text="三个", pinyin="san1 ge4"),
            meaning="three",
        )

        response = self.client.post(
            "/api/flashcards/bulk-delete",
            data=json.dumps({"ids": [card_one.id, other_card.id, 999999, card_two.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["deleted"], 2)
        self.assertEqual(set(payload["deleted_ids"]), {card_one.id, card_two.id})
        self.assertEqual(set(payload["missing_ids"]), {other_card.id, 999999})
        self.assertFalse(UserFlashcard.objects.filter(id=card_one.id).exists())
        self.assertFalse(UserFlashcard.objects.filter(id=card_two.id).exists())
        self.assertTrue(UserFlashcard.objects.filter(id=other_card.id).exists())

    def test_bulk_delete_flashcards_rejects_invalid_ids(self):
        user = User.objects.create_user(username="bulkinvalid", password="TopSecret123")
        self.client.force_login(user)

        response = self.client.post(
            "/api/flashcards/bulk-delete",
            data=json.dumps({"ids": ["bad-id"]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_update_flashcard_updates_word_pinyin_and_meaning(self):
        user = User.objects.create_user(username="harry", password="TopSecret123")
        self.client.force_login(user)

        word = Word.objects.create(text="你好", pinyin="ni3 hao3")
        flashcard = UserFlashcard.objects.create(user=user, word=word, meaning="hello")

        response = self.client.put(
            f"/api/flashcards/{flashcard.id}",
            data=json.dumps({"word": "您好", "pinyin": "nin2 hao3", "meaning": "hello (polite)"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        flashcard.refresh_from_db()
        self.assertEqual(flashcard.word.text, "您好")
        self.assertEqual(flashcard.word.pinyin, "nin2 hao3")
        self.assertEqual(flashcard.meaning, "hello (polite)")

    def test_delete_flashcard_removes_card(self):
        user = User.objects.create_user(username="ivan", password="TopSecret123")
        self.client.force_login(user)

        word = Word.objects.create(text="谢谢", pinyin="xie4 xie")
        flashcard = UserFlashcard.objects.create(user=user, word=word, meaning="thanks")

        response = self.client.delete(f"/api/flashcards/{flashcard.id}")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(UserFlashcard.objects.filter(id=flashcard.id).exists())
