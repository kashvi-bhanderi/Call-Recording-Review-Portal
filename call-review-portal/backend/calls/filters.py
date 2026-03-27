import django_filters
from datetime import datetime, timedelta, time
from .models import CallCH

class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    pass


class DashboardCallFilter(django_filters.FilterSet):
    template_id = django_filters.CharFilter(field_name="template_id", lookup_expr="exact")
    phone_number = django_filters.CharFilter(field_name="phone_number", lookup_expr="icontains")
    uuid = django_filters.CharFilter(field_name="uuid", lookup_expr="exact")
    language = CharInFilter(field_name="language", lookup_expr="in")
    schema_name = CharInFilter(field_name="schema_name", lookup_expr="in")

    created_after = django_filters.DateFilter(method="filter_created_after")
    created_before = django_filters.DateFilter(method="filter_created_before")

    class Meta:
        model = CallCH
        fields = [
            "template_id",
            "phone_number",
            "uuid",
            "language",
            "schema_name",
        ]

    def filter_created_after(self, queryset, name, value):
        dt = datetime.combine(value, time.min)
        return queryset.filter(attempt_on_time_stamp__gte=dt)

    def filter_created_before(self, queryset, name, value):
        dt = datetime.combine(value, time.max)
        return queryset.filter(attempt_on_time_stamp__lte=dt)