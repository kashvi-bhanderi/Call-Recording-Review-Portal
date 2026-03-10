import django_filters
from datetime import datetime, timedelta, time
from .models import CallCH


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    pass


class DashboardCallFilter(django_filters.FilterSet):

    template_id = django_filters.CharFilter(lookup_expr="icontains")
    phone_number = django_filters.CharFilter(lookup_expr="icontains")
    uuid = django_filters.CharFilter(lookup_expr="exact")

    created_after = django_filters.DateFilter(method="filter_created_after")
    created_before = django_filters.DateFilter(method="filter_created_before")

    schema_name = CharInFilter(field_name="schema_name", lookup_expr="in")
    language = CharInFilter(field_name="language", lookup_expr="in")

    class Meta:
        model = CallCH
        fields = []

    # start of selected day
    def filter_created_after(self, queryset, name, value):
        start = datetime.combine(value, time.min)
        return queryset.filter(attempt_on_time_stamp__gte=start)

    # start of next day
    def filter_created_before(self, queryset, name, value):
        end = datetime.combine(value + timedelta(days=1), time.min)
        return queryset.filter(attempt_on_time_stamp__lt=end)