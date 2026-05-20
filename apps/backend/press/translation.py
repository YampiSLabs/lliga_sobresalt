from modeltranslation.translator import register, TranslationOptions
from .models import Incident

@register(Incident)
class IncidentTranslationOptions(TranslationOptions):
    fields = (
        "canonical_title",
        "short_neutral_summary",
        "scoring_notes",
        "image_disclaimer",
    )
