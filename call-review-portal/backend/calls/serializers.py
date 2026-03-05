from rest_framework import serializers
from .models import Call, EvaluationCallRating, EvaluationMetric, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = "__all__"


class EvaluationMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationMetric
        fields = "__all__"


class EvaluationCallRatingSerializer(serializers.ModelSerializer):

    class Meta:
        model = EvaluationCallRating
        fields = "__all__"

    def validate(self, data):
        parameter = data["parameter"]
        rating = data["rating"]

        if not (parameter.min_value <= rating <= parameter.max_value):
            raise serializers.ValidationError("Rating out of allowed range")

        return data


class CallSerializer(serializers.ModelSerializer):
    class Meta:
        model = Call
        fields = "__all__"

class DashboardCallSerializer(serializers.ModelSerializer):
    language_name = serializers.CharField(source="language.language_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    overall_rating = serializers.SerializerMethodField()

    class Meta:
        model = Call
        fields = [
            "id",
            "template_id",
            "language_name",
            "schema_name",
            "phone_number",
            "uuid",
            "created",
            "status_display",
            "overall_rating",
        ]

    def get_overall_rating(self, obj):
        ratings = obj.evaluationcallrating_set.all()
        if ratings.exists():
            total = sum(r.rating for r in ratings)
            return round(total / ratings.count(), 2)
        return None