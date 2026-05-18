from django.test import TestCase

from core.choices import IncidentCategory, IncidentStatus
from press.models import Incident
from league.services.scoring import calculate_points


class ScoringTests(TestCase):
    def test_calculates_points_from_code_rules(self):
        incident = Incident(
            canonical_title="Robatori violent publicat per premsa",
            category=IncidentCategory.ROBO_VIOLENTO,
            severity_1_5=4,
            confidence_0_1=0.8,
            status=IncidentStatus.PENDING_REVIEW,
        )

        self.assertEqual(calculate_points(incident), 7.0)

    def test_transport_gets_bonus(self):
        incident = Incident(
            canonical_title="Incident al metro",
            category=IncidentCategory.TRANSPORTE_PUBLICO,
            severity_1_5=3,
            confidence_0_1=0.8,
            status=IncidentStatus.PENDING_REVIEW,
        )

        self.assertEqual(calculate_points(incident), 7.0)

    def test_duplicate_scores_zero(self):
        incident = Incident(
            canonical_title="Duplicate",
            category=IncidentCategory.HOMICIDIO,
            severity_1_5=5,
            confidence_0_1=1,
            status=IncidentStatus.DUPLICATE,
        )

        self.assertEqual(calculate_points(incident), 0)

