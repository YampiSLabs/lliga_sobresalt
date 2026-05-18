from django.test import TestCase
from django.urls import reverse


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
