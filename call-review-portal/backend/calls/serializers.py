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
    duration_display = serializers.SerializerMethodField()

    rated_by_name = serializers.CharField(source="rated_by.username", read_only=True)
    tags_display = serializers.SerializerMethodField()

    class Meta:
        model = Call
        fields = [
            "id",
            "template_id",
            "language_name",
            "schema_name",
            "phone_number",
            "uuid",
            "attempt_on_time_stamp",
            "duration_display",
            "status_display",
            "overall_rating",
            "rated_by_name",
            "tags_display",
        ]
    def get_tags_display(self, obj):
       return ", ".join(tag.name for tag in obj.tags.all())

    def get_overall_rating(self, obj):
        ratings = obj.evaluationcallrating_set.all()
        if ratings.exists():
            total = sum(r.rating for r in ratings)
            return round(total / ratings.count(), 2)
        return None

    def get_duration_display(self, obj):
        if obj.duration is None:
            return "-"
        minutes = obj.duration // 60
        seconds = obj.duration % 60
        return f"{minutes}m {seconds}s"