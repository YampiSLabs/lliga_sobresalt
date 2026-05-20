from modeltranslation.translator import register, TranslationOptions
from .models import SatiricalHeadline

@register(SatiricalHeadline)
class SatiricalHeadlineTranslationOptions(TranslationOptions):
    fields = ("text",)
