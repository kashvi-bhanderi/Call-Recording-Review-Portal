from django.contrib import admin
from .models import Call, Tag, EvaluationMetric, EvaluationCallRating, EntityDefinition


admin.site.register(Tag)
admin.site.register(EvaluationMetric)
admin.site.register(EntityDefinition)

