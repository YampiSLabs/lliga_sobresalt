import re

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("core.urls")),
]

def media_urlpatterns():
    if settings.DEBUG:
        return static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    if settings.SERVE_MEDIA_FILES:
        media_prefix = re.escape(settings.MEDIA_URL.lstrip("/"))
        return [
            re_path(
                rf"^{media_prefix}(?P<path>.*)$",
                serve,
                {"document_root": settings.MEDIA_ROOT},
            )
        ]
    return []


urlpatterns += media_urlpatterns()
