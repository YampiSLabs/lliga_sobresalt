from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Iterable
from urllib.parse import urljoin, urlparse

import feedparser
import httpx
import trafilatura
from bs4 import BeautifulSoup
from django.utils import timezone

from core.choices import RawArticleStatus
from press.models import Outlet, RawArticle

logger = logging.getLogger(__name__)

USER_AGENT = "LaLligaDelSobresaltBot/0.1 (+local MVP; respects paywalls)"
REQUEST_TIMEOUT = 15


@dataclass(frozen=True)
class ScrapedArticle:
    url: str
    headline: str
    excerpt: str | None = None
    raw_text: str | None = None
    published_at: datetime | None = None


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
        else:
            status = RawArticleStatus.NEW
        RawArticle.objects.create(
            outlet=outlet,
            url=article.url,
            headline=article.headline[:500],
            excerpt=article.excerpt,
            raw_text=article.raw_text,
            published_at=article.published_at,
            content_hash=article_hash,
            status=status,
        )
        created += 1
    return created


def scrape_rss(rss_url: str) -> list[ScrapedArticle]:
    parsed = feedparser.parse(rss_url, request_headers={"User-Agent": USER_AGENT})
    articles: list[ScrapedArticle] = []
    for entry in parsed.entries[:50]:
        url = getattr(entry, "link", None)
        title = getattr(entry, "title", "").strip()
        if not url or not title:
            continue
        excerpt = getattr(entry, "summary", None)
        raw_text = extract_text_from_url(url)
        published_at = parse_feed_date(getattr(entry, "published", None))
        articles.append(
            ScrapedArticle(
                url=url,
                headline=title,
                excerpt=excerpt,
                raw_text=raw_text,
                published_at=published_at,
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
    return [article for article in (scrape_article_url(url) for url in urls[:30]) if article]


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
    raw_text = trafilatura.extract(html, include_comments=False, include_tables=False)
    return ScrapedArticle(url=url, headline=headline, excerpt=excerpt, raw_text=raw_text)


def fetch_html(url: str) -> str | None:
    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
            response = client.get(url, follow_redirects=True)
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
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            continue
        if not parsed.netloc.endswith(domain):
            continue
        clean_url = parsed._replace(fragment="").geturl()
        if clean_url not in links:
            links.append(clean_url)
    return links


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
