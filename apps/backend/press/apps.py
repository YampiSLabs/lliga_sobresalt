from django.apps import AppConfig


class PressConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "press"

    def ready(self):
        import press.signals
