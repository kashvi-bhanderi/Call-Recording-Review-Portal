import django_filters
from datetime import timedelta
from .models import Call


class DashboardCallFilter(django_filters.FilterSet):

    template_id = django_filters.CharFilter(lookup_expr="icontains")
    phone_number = django_filters.CharFilter(lookup_expr="icontains")
    uuid = django_filters.CharFilter(lookup_expr="exact")

    created_after = django_filters.DateFilter(field_name="attempt_on_time_stamp", lookup_expr="gte")
    created_before = django_filters.DateFilter(method="filter_attempt_before")

    schema_name = django_filters.BaseInFilter(field_name="schema_name", lookup_expr="in")
    language = django_filters.BaseInFilter(field_name="language", lookup_expr="in")
    status = django_filters.BaseInFilter(field_name="status", lookup_expr="in")

    rated_by = django_filters.NumberFilter(field_name="rated_by_id")
    tags = django_filters.BaseInFilter(field_name="tags__id", lookup_expr="in")

    class Meta:

        model = Call
        fields = []
    def filter_attempt_before(self, queryset, name, value):
      return queryset.filter(attempt_on_time_stamp__lt=value + timedelta(days=1))