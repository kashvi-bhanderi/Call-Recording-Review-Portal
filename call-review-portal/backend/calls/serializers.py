from rest_framework import serializers
from .models import CallCH, EvaluationCallRating, Tag
from accounts.models import Language, User

class DashboardCallSerializer(serializers.ModelSerializer):
    language_name = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    overall_rating = serializers.SerializerMethodField()
    duration_display = serializers.SerializerMethodField()
    rated_by_name = serializers.SerializerMethodField()
    tags_display = serializers.SerializerMethodField()
    attempt_on_time_stamp = serializers.DateTimeField()

    class Meta:
        model = CallCH
        fields = [
            "uuid",
            "template_id",
            "language_name",
            "schema_name",
            "phone_number",
            "duration_display",
            "status_display",
            "overall_rating",
            "rated_by_name",
            "tags_display",
            "attempt_on_time_stamp",
        ]

    # ------------------------
    # LANGUAGE NAME
    # ------------------------
    def get_language_name(self, obj):
        lang = Language.objects.filter(language=obj.language).first()
        return lang.language_name if lang else obj.language

    # ------------------------
    # STATUS DISPLAY
    # ------------------------
    def get_status_display(self, obj):
        calls_map = self.context.get("calls_map", {})
        call = calls_map.get(obj.uuid)
        return call.get_status_display() if call else "Not Rated"

    # ------------------------
    # RATED BY
    # ------------------------
    def get_rated_by_name(self, obj):
        calls_map = self.context.get("calls_map", {})
        users_map = self.context.get("users_map", {})
        call = calls_map.get(obj.uuid)
        if call and call.rated_by_id:
            user = users_map.get(call.rated_by_id)
            return user.username if user else None
        return None

    # ------------------------
    # TAGS
    # ------------------------
    def get_tags_display(self, obj):
        calls_map = self.context.get("calls_map", {})
        call = calls_map.get(obj.uuid)
        if call:
            return ", ".join(tag.name for tag in call.tags.all())
        return ""

    # ------------------------
    # OVERALL RATING
    # ------------------------
    def get_overall_rating(self, obj):
        calls_map = self.context.get("calls_map", {})
        call = calls_map.get(obj.uuid)
        if call:
            ratings = call.evaluationcallrating_set.all()
            if ratings.exists():
                total = sum(r.rating for r in ratings)
                return round(total / ratings.count(), 2)
        return None

    # ------------------------
    # DURATION DISPLAY
    # ------------------------
    def get_duration_display(self, obj):
        if obj.duration is None:
            return "-"
        minutes = obj.duration // 60
        seconds = obj.duration % 60
        return f"{minutes}m {seconds}s"