"""Celery application for La Lliga del Sobresalt."""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("lliga_sobresalt")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

