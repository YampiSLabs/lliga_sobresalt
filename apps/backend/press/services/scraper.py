from __future__ import annotations

import hashlib
import ipaddress
import io
import logging
import os
import re
import uuid
from dataclasses import dataclass
from PIL import Image
from PIL import UnidentifiedImageError
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Iterable
from urllib.parse import urljoin, urlparse

import feedparser
import httpx
import trafilatura
from bs4 import BeautifulSoup
from django.conf import settings
from django.utils import timezone

from core.choices import RawArticleStatus
from press.models import Outlet, RawArticle
from press.services.extractor import text_matches_cities, text_matches_keywords

logger = logging.getLogger(__name__)

USER_AGENT = "LaLligaDelSobresaltBot/0.1 (+local MVP; respects paywalls)"
REQUEST_TIMEOUT = 15
ARTICLE_PATH_RE = re.compile(r"/(?:\d{4}/\d{2}/\d{2}/[^/]+|ca/[^/]+/[^/]+_\d+(?:_\d+)?)\.html$")


@dataclass(frozen=True)
class ScrapedArticle:
    url: str
    headline: str
    excerpt: str | None = None
    raw_text: str | None = None
    published_at: datetime | None = None
    image_url: str | None = None


def content_hash_for(headline: str, excerpt: str | None, raw_text: str | None) -> str:
    payload = "\n".join([headline.strip(), excerpt or "", raw_text or ""])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def scrape_active_outlets() -> tuple[int, int]:
    created = 0
    errors = 0
    for outlet in Outlet.objects.filter(is_active=True):
        try:
            outlet_created = scrape_outlet(outlet)
            created += outlet_created
            logger.info("scraped outlet=%s created=%s", outlet.slug, outlet_created)
        except Exception:
            errors += 1
            logger.exception("scrape failed outlet=%s", outlet.slug)
    return created, errors


def scrape_outlet(outlet: Outlet) -> int:
    articles: list[ScrapedArticle] = []
    if outlet.rss_url:
        articles.extend(scrape_rss(outlet.rss_url))
    if outlet.section_url:
        articles.extend(scrape_section(outlet))

    created = 0
    seen_urls: set[str] = set()
    for article in articles:
        if article.url in seen_urls or RawArticle.objects.filter(url=article.url).exists():
            continue
        seen_urls.add(article.url)
        article_hash = content_hash_for(article.headline, article.excerpt, article.raw_text)
        if RawArticle.objects.filter(content_hash=article_hash).exists():
            status = RawArticleStatus.IGNORED
        elif not text_matches_keywords(article.headline, article.excerpt, article.raw_text):
            status = RawArticleStatus.IGNORED
        elif not text_matches_cities(article.headline, article.excerpt, article.raw_text):
            status = RawArticleStatus.IGNORED
        else:
            status = RawArticleStatus.NEW

        downloaded_image_url = None
        downloaded_thumbnail_url = None
        if status != RawArticleStatus.IGNORED and article.image_url:
            downloaded_image_url, downloaded_thumbnail_url = download_image(article.image_url, outlet.slug)

        RawArticle.objects.create(
            outlet=outlet,
            url=article.url,
            headline=article.headline[:500],
            excerpt=article.excerpt,
            raw_text=article.raw_text,
            published_at=article.published_at,
            content_hash=article_hash,
            status=status,
            image_url=downloaded_image_url,
            thumbnail_url=downloaded_thumbnail_url,
        )
        created += 1
    return created


def scrape_rss(rss_url: str) -> list[ScrapedArticle]:
    if not is_safe_public_url(rss_url):
        logger.warning("rss url rejected url=%s", rss_url)
        return []
    parsed = feedparser.parse(rss_url, request_headers={"User-Agent": USER_AGENT})
    articles: list[ScrapedArticle] = []
    for entry in parsed.entries[:50]:
        url = getattr(entry, "link", None)
        title = getattr(entry, "title", "").strip()
        if not url or not title:
            continue
        if not is_safe_public_url(url):
            logger.warning("rss entry url rejected url=%s", url)
            continue
        excerpt = getattr(entry, "summary", None)

        if RawArticle.objects.filter(url=url).exists():
            continue

        if not text_matches_keywords(title, excerpt):
            published_at = parse_feed_date(getattr(entry, "published", None))
            articles.append(
                ScrapedArticle(
                    url=url,
                    headline=title,
                    excerpt=excerpt,
                    raw_text=None,
                    published_at=published_at,
                    image_url=None,
                )
            )
            continue

        raw_text, image_url = extract_text_and_image_from_url(url)
        published_at = parse_feed_date(getattr(entry, "published", None))
        articles.append(
            ScrapedArticle(
                url=url,
                headline=title,
                excerpt=excerpt,
                raw_text=raw_text,
                published_at=published_at,
                image_url=image_url,
            )
        )
    return articles


def scrape_section(outlet: Outlet) -> list[ScrapedArticle]:
    if not outlet.section_url:
        return []
    html = fetch_html(outlet.section_url)
    if not html:
        return []
    urls = extract_internal_links(html, outlet.section_url, outlet.domain)
    urls = [url for url in urls if is_probable_article_url(url)]

    # Pre-filter to avoid scraping URLs we already have in the database
    new_urls = []
    for url in urls:
        if not RawArticle.objects.filter(url=url).exists():
            new_urls.append(url)
            if len(new_urls) >= 30:
                break

    return [article for article in (scrape_article_url(url) for url in new_urls) if article]


def scrape_article_url(url: str) -> ScrapedArticle | None:
    html = fetch_html(url)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    headline = extract_headline(soup)
    if not headline:
        return None
    excerpt_node = soup.find("meta", attrs={"name": "description"})
    excerpt = excerpt_node.get("content") if excerpt_node else None
    image_url = extract_og_image(soup)
    raw_text = trafilatura.extract(html, include_comments=False, include_tables=False)
    return ScrapedArticle(url=url, headline=headline, excerpt=excerpt, raw_text=raw_text, image_url=image_url)


def fetch_html(url: str) -> str | None:
    if not is_safe_public_url(url):
        logger.warning("fetch rejected unsafe url=%s", url)
        return None
    try:
        with httpx.Client(
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
            max_redirects=3,
        ) as client:
            response = client.get(url, follow_redirects=True)
            final_url = response_url_or_default(response, url)
            if not is_safe_public_url(final_url):
                logger.warning("fetch rejected unsafe final url=%s", final_url)
                return None
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "html" not in content_type and "xml" not in content_type and content_type:
                return None
            return response.text
    except httpx.HTTPError:
        logger.warning("fetch failed url=%s", url, exc_info=True)
        return None


def extract_text_from_url(url: str) -> str | None:
    try:
        html = fetch_html(url)
        if not html:
            return None
        return trafilatura.extract(html, include_comments=False, include_tables=False)
    except Exception:
        logger.warning("text extraction failed url=%s", url, exc_info=True)
        return None


def extract_og_image(soup: BeautifulSoup) -> str | None:
    meta = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
    if meta and meta.get("content"):
        return meta.get("content").strip()
    return None


def extract_text_and_image_from_url(url: str) -> tuple[str | None, str | None]:
    try:
        html = fetch_html(url)
        if not html:
            return None, None
        soup = BeautifulSoup(html, "html.parser")
        image_url = extract_og_image(soup)
        raw_text = trafilatura.extract(html, include_comments=False, include_tables=False)
        return raw_text, image_url
    except Exception:
        logger.warning("text and image extraction failed url=%s", url, exc_info=True)
        return None, None


def download_image(image_url: str, outlet_slug: str) -> tuple[str | None, str | None]:
    if not image_url:
        return None, None
    if not is_safe_public_url(image_url):
        logger.warning("image rejected unsafe url=%s", image_url)
        return None, None
    try:
        with httpx.Client(timeout=10, headers={"User-Agent": USER_AGENT}, max_redirects=3) as client:
            response = client.get(image_url, follow_redirects=True)
            if response.status_code == 200:
                final_url = response_url_or_default(response, image_url)
                if not is_safe_public_url(final_url):
                    logger.warning("image rejected unsafe final url=%s", final_url)
                    return None, None
                content_type = response.headers.get("content-type", "")
                if content_type and not content_type.lower().startswith("image/"):
                    logger.warning("image rejected content_type=%s url=%s", content_type, image_url)
                    return None, None
                max_bytes = getattr(settings, "SCRAPER_MAX_IMAGE_BYTES", 5 * 1024 * 1024)
                if len(response.content) > max_bytes:
                    logger.warning("image rejected oversized bytes=%s url=%s", len(response.content), image_url)
                    return None, None
                uid = uuid.uuid4().hex
                filename_main = f"{outlet_slug}_{uid}.webp"
                filename_thumb = f"{outlet_slug}_{uid}_thumb.webp"

                media_dir = os.path.join(settings.MEDIA_ROOT, "news_images")
                os.makedirs(media_dir, exist_ok=True)

                path_main = os.path.join(media_dir, filename_main)
                path_thumb = os.path.join(media_dir, filename_thumb)

                # Cargar imagen en memoria con PIL
                image_data = io.BytesIO(response.content)
                with Image.open(image_data) as img:
                    img.verify()

                image_data.seek(0)
                with Image.open(image_data) as img:
                    # Normalizar canal de color a RGB si es necesario
                    if img.mode not in ("RGB", "RGBA"):
                        img_converted = img.convert("RGB")
                    else:
                        img_converted = img

                    # 1. Comprimir imagen principal (WebP, max-width 1200px)
                    max_width = 1200
                    if img_converted.width > max_width:
                        ratio = max_width / float(img_converted.width)
                        new_height = int(float(img_converted.height) * ratio)
                        img_main = img_converted.resize((max_width, new_height), Image.Resampling.LANCZOS)
                    else:
                        img_main = img_converted

                    img_main.save(path_main, format="WEBP", quality=80)

                    # 2. Generar Thumbnail de mínimo espacio (WebP, max-width 320px)
                    thumb_width = 320
                    ratio_thumb = thumb_width / float(img_converted.width)
                    thumb_height = int(float(img_converted.height) * ratio_thumb)
                    img_thumb = img_converted.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)

                    img_thumb.save(path_thumb, format="WEBP", quality=65)

                return f"/media/news_images/{filename_main}", f"/media/news_images/{filename_thumb}"
    except (Image.DecompressionBombError, UnidentifiedImageError) as e:
        logger.warning("Rejected unsafe image %s: %s", image_url, e, exc_info=True)
    except Exception as e:
        logger.warning("Failed to download or optimize image %s: %s", image_url, e, exc_info=True)
    return None, None


def extract_headline(soup: BeautifulSoup) -> str:
    h1 = soup.find("h1")
    if h1 and h1.get_text(strip=True):
        return h1.get_text(" ", strip=True)
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    return ""


def extract_internal_links(html: str, base_url: str, domain: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    for anchor in soup.find_all("a", href=True):
        url = urljoin(base_url, anchor["href"])
        if not is_allowed_outlet_url(url, domain):
            continue
        parsed = urlparse(url)
        clean_url = parsed._replace(fragment="").geturl()
        if clean_url not in links:
            links.append(clean_url)
    return links


def is_allowed_outlet_url(url: str, domain: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    allowed_domain = domain.lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or not host:
        return False
    return host == allowed_domain or host.endswith(f".{allowed_domain}")


def response_url_or_default(response: httpx.Response, default: str) -> str:
    response_url = getattr(response, "url", default)
    if isinstance(response_url, (str, httpx.URL)):
        return str(response_url)
    return default


def is_safe_public_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or not host:
        return False
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".localhost"):
        return False
    try:
        return is_public_ip(host)
    except ValueError:
        return True


def is_public_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def is_probable_article_url(url: str) -> bool:
    path = urlparse(url).path
    return bool(ARTICLE_PATH_RE.search(path))


def parse_feed_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed)
        return parsed
    except (TypeError, ValueError):
        return None
