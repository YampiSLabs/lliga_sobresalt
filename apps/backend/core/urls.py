from django.urls import path

from core import views

app_name = "core"

urlpatterns = [
    path("", views.home, name="home"),
    path("ranking/", views.weekly_ranking, name="weekly_ranking"),
    path("ciutats/<slug:slug>/", views.city_detail, name="city_detail"),
    path("incidents/<int:pk>/", views.incident_detail, name="incident_detail"),
    path("api/ranking/", views.api_ranking, name="api_ranking"),
    path("api/cities/", views.api_cities, name="api_cities"),
    path("api/incidents/", views.api_incidents, name="api_incidents"),
    path("api/seasons/", views.api_seasons, name="api_seasons"),
]
