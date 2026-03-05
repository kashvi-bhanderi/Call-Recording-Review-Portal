import django_filters
from .models import Call


import django_filters
from .models import Call


class DashboardCallFilter(django_filters.FilterSet):

    template_id = django_filters.CharFilter(lookup_expr="icontains")
    phone_number = django_filters.CharFilter(lookup_expr="icontains")
    uuid = django_filters.CharFilter(lookup_expr="exact")

    # DATE RANGE
    created_after = django_filters.DateTimeFilter(field_name="created", lookup_expr="gte")
    created_before = django_filters.DateTimeFilter(field_name="created", lookup_expr="lte")

    # SCHEMA MULTI SELECT
    schema_name = django_filters.BaseInFilter(field_name="schema_name", lookup_expr="in")

    # LANGUAGE MULTI SELECT
    language = django_filters.BaseInFilter(field_name="language__id", lookup_expr="in")

    # STATUS MULTI SELECT
    status = django_filters.BaseInFilter(field_name="status", lookup_expr="in")

    reviewed_by = django_filters.NumberFilter(field_name="reviewed_by_id")
    tags = django_filters.BaseInFilter(field_name="tags__id", lookup_expr="in")

    class Meta:
        model = Call
        fields = []