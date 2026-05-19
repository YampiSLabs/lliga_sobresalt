from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.test import TestCase
from django.urls import reverse

from core.llm import chat_completion_json, get_llm_config


class FrontendAssetTests(TestCase):
    def test_base_template_uses_local_compiled_css(self):
        response = self.client.get(reverse("core:home"))

        self.assertContains(response, "/static/css/app.css")
        self.assertNotContains(response, "cdn.tailwindcss.com")


class SecurityHeaderTests(TestCase):
    def test_public_pages_send_security_headers(self):
        response = self.client.get(reverse("core:home"))

        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["Referrer-Policy"], "same-origin")
        self.assertIn("geolocation=()", response.headers["Permissions-Policy"])


class PublicApiTests(TestCase):
    def test_public_api_does_not_expose_raw_text(self):
        response = self.client.get(reverse("core:api_incidents"))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "raw_text")


class LlmConfigTests(TestCase):
    @override_settings(
        OPENROUTER_API_KEY="test-key",
        OPENROUTER_BASE_URL="https://openrouter.ai/api/v1",
        OPENROUTER_MODEL="openrouter/free",
        OPENROUTER_TIMEOUT_SECONDS=60,
        OPENROUTER_SITE_URL="https://example.com",
        OPENROUTER_APP_NAME="La Lliga del Sobresalt",
    )
    def test_openrouter_config_wins_when_api_key_exists(self):
        config = get_llm_config()

        self.assertEqual(config["provider"], "openrouter")
        self.assertEqual(config["url"], "https://openrouter.ai/api/v1/chat/completions")
        self.assertEqual(config["model"], "openrouter/free")
        self.assertEqual(config["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(config["headers"]["HTTP-Referer"], "https://example.com")
        self.assertEqual(config["headers"]["X-Title"], "La Lliga del Sobresalt")

    @override_settings(
        OPENROUTER_API_KEY="",
        OLLAMA_BASE_URL="http://localhost:11434/v1",
        OLLAMA_MODEL="qwen3:4b",
        OLLAMA_TIMEOUT_SECONDS=60,
    )
    def test_ollama_config_is_fallback_without_openrouter_key(self):
        config = get_llm_config()

        self.assertEqual(config["provider"], "ollama")
        self.assertEqual(config["url"], "http://localhost:11434/v1/chat/completions")
        self.assertEqual(config["model"], "qwen3:4b")
        self.assertEqual(config["headers"], {})

    @override_settings(
        OPENROUTER_API_KEY="test-key",
        OPENROUTER_BASE_URL="https://openrouter.ai/api/v1",
        OPENROUTER_MODEL="openrouter/free",
        OPENROUTER_TIMEOUT_SECONDS=60,
        OPENROUTER_SITE_URL="",
        OPENROUTER_APP_NAME="La Lliga del Sobresalt",
    )
    @patch("core.llm.httpx.Client")
    def test_chat_completion_uses_openrouter_free_model(self, client_class):
        response = MagicMock()
        response.json.return_value = {"choices": [{"message": {"content": '{"ok":true}'}}]}
        client = client_class.return_value.__enter__.return_value
        client.post.return_value = response

        result = chat_completion_json(
            [{"role": "user", "content": "Devuelve JSON"}],
            temperature=0,
            purpose="test",
            retries=0,
        )

        self.assertEqual(result, '{"ok":true}')
        client.post.assert_called_once()
        _, kwargs = client.post.call_args
        self.assertEqual(kwargs["json"]["model"], "openrouter/free")
        self.assertEqual(kwargs["json"]["response_format"], {"type": "json_object"})
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
