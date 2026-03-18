from rest_framework import serializers
from .models import CallCH, EvaluationCallRating, Tag
from accounts.models import Language, User
from django.utils import timezone
from rest_framework import serializers
from .models import Call, EvaluationCallRating, EvaluationMetric

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

        if not call:
            return None

        ratings = call.evaluationcallrating_set.all()

        if not ratings.exists():
            return None

        # If lead has submitted review, reviewed_by stores the lead user
        if call.reviewed_by_id:
            lead_ratings = ratings.filter(rated_by_id=call.reviewed_by_id)
            if lead_ratings.exists():
                total = sum(r.rating for r in lead_ratings)
                return round(total / lead_ratings.count(), 2)

        # Otherwise (or fallback), show consultant ratings
        consultant_ratings = ratings
        if call.reviewed_by_id:
            consultant_ratings = consultant_ratings.exclude(rated_by_id=call.reviewed_by_id)

        if consultant_ratings.exists():
            total = sum(r.rating for r in consultant_ratings)
            return round(total / consultant_ratings.count(), 2)

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


class EvaluationCallRatingSerializer(serializers.Serializer):
    call_uuid = serializers.CharField()
    ratings = serializers.DictField(
        child=serializers.IntegerField(min_value=1),  # Dynamic based on EvaluationMetric
    )
    comments = serializers.CharField(required=False, allow_blank=True)

    def validate_call_uuid(self, value):
        try:
            call = Call.objects.get(uuid=value)
        except Call.DoesNotExist:
            raise serializers.ValidationError("Call not found")
        return value

    def validate(self, data):
        # Validate ratings are within metric range
        call = Call.objects.get(uuid=data['call_uuid'])
        for param_name, rating in data['ratings'].items():
            try:
                metric = EvaluationMetric.objects.get(name=param_name)
            except EvaluationMetric.DoesNotExist:
                raise serializers.ValidationError(f"Invalid parameter: {param_name}")
            if not (metric.min_value <= rating <= metric.max_value):
                raise serializers.ValidationError(f"Rating for {param_name} out of allowed range")
        return data

    def create_or_update_ratings(self, user):
        """
        Create or update EvaluationCallRating entries for this call.
        """
        call = Call.objects.get(uuid=self.validated_data['call_uuid'])
        ratings_data = self.validated_data['ratings']
        comments = self.validated_data.get('comments', '')

        for param_name, rating in ratings_data.items():
            metric = EvaluationMetric.objects.get(name=param_name)
            obj, created = EvaluationCallRating.objects.update_or_create(
                call=call,
                parameter=metric,
                rated_by=user,
                defaults={'rating': rating}
            )

        # Update the call fields: status and consultant comment
        if call.status == 1:  # Not Rated
            call.status = 2  # Completed
        call.consultant_comment = comments
        call.rated_by = user
        call.rated_at = timezone.now()
        call.save()
        return call