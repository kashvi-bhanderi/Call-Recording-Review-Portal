from django.contrib import admin
from .models import Call, Tag, EvaluationMetric, EvaluationCallRating


admin.site.register(Tag)
admin.site.register(EvaluationMetric)
