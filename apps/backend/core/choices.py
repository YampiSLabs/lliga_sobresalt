from django.db import models


class RawArticleStatus(models.TextChoices):
    NEW = "new", "New"
    PROCESSING = "processing", "Processing"
    IGNORED = "ignored", "Ignored"
    CANDIDATE = "candidate", "Candidate"
    PROCESSED = "processed", "Processed"
    FAILED = "failed", "Failed"
    FAILED_AI = "failed_ai", "Failed AI"


class IncidentCategory(models.TextChoices):
    APUNYALAMENT = "apunyalament", "Apunyalament"
    ARMA_BLANCA = "arma_blanca", "Arma blanca"
    HOMICIDIO = "homicidio", "Homicidio"
    ROBO_VIOLENTO = "robo_violento", "Robo violento"
    PELEA = "pelea", "Pelea"
    AGRESION = "agresion", "Agresion"
    INCIVISMO = "incivismo", "Incivismo"
    DISTURBIOS = "disturbios", "Disturbios"
    TRANSPORTE_PUBLICO = "transporte_publico", "Transporte publico"
    OTRO_SUCESO = "otro_suceso", "Otro suceso"
    NO_RELEVANTE = "no_relevante", "No relevante"


class IncidentStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PENDING_REVIEW = "pending_review", "Pending review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    DUPLICATE = "duplicate", "Duplicate"


class RoundStatus(models.TextChoices):
    OPEN = "open", "Open"
    CLOSED = "closed", "Closed"


class HeadlineTone(models.TextChoices):
    DEPORTIVO = "deportivo", "Deportivo"
    ABSURDO = "absurdo", "Absurdo"
    IRONICO = "ironico", "Ironico"
    SUAVE = "suave", "Suave"


class RiskLevel(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"

