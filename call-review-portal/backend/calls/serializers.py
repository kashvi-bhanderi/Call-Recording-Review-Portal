from rest_framework import serializers
from .models import CallCH, EvaluationCallRating, Tag, CallTurnwiseCH
from accounts.models import Language, User, Organization, Template
from django.utils import timezone
from rest_framework import serializers
from .models import Call, EvaluationCallRating, EvaluationMetric
from django.db import transaction
from rest_framework.exceptions import ValidationError
import re
class DashboardCallSerializer(serializers.ModelSerializer):
    language_name = serializers.SerializerMethodField()
    organization_name = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    template_name = serializers.SerializerMethodField()
    overall_rating = serializers.SerializerMethodField()
    duration_display = serializers.SerializerMethodField()
    rated_by_name = serializers.SerializerMethodField()
    tags_display = serializers.SerializerMethodField()
    attempt_on_time_stamp = serializers.DateTimeField()
    metrics = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    entities = serializers.SerializerMethodField()  
    lock_message = serializers.SerializerMethodField()
    good_audio_to_share = serializers.SerializerMethodField()
    class Meta:
        model = CallCH
        fields = [
            "uuid",
            "template_id",
            "template_name",
            "language_name",
            "organization_name",
            "schema_name",
            "phone_number",
            "turns",
            "duration_display",
            "status_display",
            "overall_rating",
            "rated_by_name",
            "tags_display",
            "attempt_on_time_stamp",
            "metrics",
            "is_locked",
            "lock_message",
            "entities",
            "good_audio_to_share",
        ]

    def get_entities(self, obj):
        raw = obj.entities

        if not raw or raw == "None":
            return {}

        if isinstance(raw, dict):
            return raw

        if isinstance(raw, str):
            pairs = re.findall(r'"(.*?)"\s*=>\s*"(.*?)"', raw)
            return {k: v for k, v in pairs}

        return {}
    # ------------------------
    # LANGUAGE NAME
    # ------------------------
    def get_language_name(self, obj):
        lang = Language.objects.filter(language=obj.language).first()
        return lang.language_name if lang else obj.language
    
    # ------------------------
    # ORGANIZATION NAME
    # ------------------------

    def get_organization_name(self, obj):
        org = Organization.objects.filter(schema_name=obj.schema_name).first()
        return org.org_name if org else obj.schema_name 
    
    def get_template_name(self, obj):
        template = Template.objects.filter(
            organization__schema_name=obj.schema_name,
            template_id=obj.template_id,
            is_active=True
        ).first()

        return template.template_name if template else f"Template {obj.template_id}"
    
    def get_good_audio_to_share(self, obj):
        calls_map = self.context.get("calls_map", {})
        call = calls_map.get(obj.uuid)

        if not call:
            return None

        return call.good_audio_to_share  # can be True / False / None
    
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
        return f"{minutes:02}: {seconds:02}"

    def get_metrics(self, obj):
        calls_map = self.context.get("calls_map", {})
        call = calls_map.get(obj.uuid)

        metrics = EvaluationMetric.objects.filter(is_active=True)
        result = []

        for metric in metrics:
            value = None

            if call:
                rating_qs = EvaluationCallRating.objects.filter(
                    call=call,
                    parameter=metric
                )

                # If lead reviewed, dashboard should show lead rating
                if call.reviewed_by_id:
                    rating = rating_qs.filter(rated_by_id=call.reviewed_by_id).first()
                # Else show consultant rating
                elif call.rated_by_id:
                    rating = rating_qs.filter(rated_by_id=call.rated_by_id).first()
                else:
                    rating = None

                if rating:
                    value = rating.rating

            result.append({
                "name": metric.name,
                "min": metric.min_value,
                "max": metric.max_value,
                "value": value
            })

        return result

    def get_is_locked(self, obj):
        calls_map = self.context.get("calls_map", {})
        request = self.context.get("request")
        call = calls_map.get(obj.uuid)

        if not call:
            return False

        if call.rating_locked or call.status in [3, 4]:
            return True

        if request and call.rated_by_id and call.rated_by_id != request.user.id:
            return True

        return False


    def get_lock_message(self, obj):
        calls_map = self.context.get("calls_map", {})
        request = self.context.get("request")
        call = calls_map.get(obj.uuid)

        if not call:
            return ""

        if call.status in [3, 4]:
            return "Lead reviewed this call. You cannot update it."
        
        if call.rating_locked:
            return "Lead is reviewing this call. Editing temporarily disabled"

        if request and call.rated_by_id and call.rated_by_id != request.user.id:
            return "Another consultant already rated this call."

        return ""
    
class EvaluationCallRatingSerializer(serializers.Serializer):
    call_uuid = serializers.CharField()
    ratings = serializers.DictField(
        child=serializers.IntegerField(min_value=1),  # Dynamic based on EvaluationMetric
    )
    comments = serializers.CharField(required=False, allow_blank=True)

    def validate_call_uuid(self, value):
    # Call must exist in ClickHouse
        try:
            ch_call = CallCH.objects.using("clickhouse").get(uuid=value)
        except CallCH.DoesNotExist:
            raise serializers.ValidationError("Call not found")

        Call.objects.get_or_create(
            uuid=value,
            defaults={"attempt_on_time_stamp": ch_call.attempt_on_time_stamp}
        )

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
        Only the FIRST consultant can rate this call.
        If another consultant already rated, block it.
        Race-condition safe.
        """
        with transaction.atomic():
            call = Call.objects.select_for_update().get(uuid=self.validated_data['call_uuid'])

            # If lead is reviewing / reviewed, consultant cannot rate
            if call.rating_locked or call.status in [3, 4]:
                raise ValidationError("Lead is reviewing this call")

            # If already rated by another consultant -> block
            if call.rated_by_id and call.rated_by_id != user.id:
                raise ValidationError("Another consultant already rated this call")

            ratings_data = self.validated_data['ratings']
            comments = self.validated_data.get('comments', '')

            # Save/update ONLY this consultant's ratings
            for param_name, rating in ratings_data.items():
                metric = EvaluationMetric.objects.get(name=param_name)

                EvaluationCallRating.objects.update_or_create(
                    call=call,
                    parameter=metric,
                    rated_by=user,
                    defaults={'rating': rating}
                )

            # Mark this consultant as the owner of the review
            if call.status == 1:
                call.status = 2

            call.consultant_comment = comments
            call.rated_by = user
            call.rated_at = timezone.now()
            call.save()

            return call
        
class CallTranscriptRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallTurnwiseCH
        fields = ["round", "stt_output", "tts_input"]