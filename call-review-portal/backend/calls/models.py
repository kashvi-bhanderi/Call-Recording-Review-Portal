from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from accounts.models import Language


# ------------------------
# TAG MODEL
# ------------------------

class Tag(models.Model):
    id = models.SmallAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


# ------------------------
# EVALUATION METRIC
# ------------------------

class EvaluationMetric(models.Model):
    name = models.CharField(max_length=255, unique=True)
    min_value = models.SmallIntegerField()
    max_value = models.SmallIntegerField()
    is_active = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


# ------------------------
# CALL MODEL
# ------------------------

class Call(models.Model):

    STATUS_CHOICES = (
        (1, "Not Rated"),
        (2, "Completed"),
        (3, "Need Fix"),
        (4, "Approved"),
    )

    ALLOWED_TRANSITIONS = {
        1: [2],
        2: [3, 4],
        3: [],
        4: [],
    }

    uuid = models.TextField(unique=True, db_index=True)
    schema_name = models.TextField(db_index=True)
    phone_number = models.TextField(db_index=True)
    template_id = models.IntegerField(db_index=True)
    duration = models.IntegerField(null=True, blank=True)
    language = models.TextField(db_index=True)

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="reviewed_calls",
        on_delete=models.SET_NULL,
        db_index=True
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    lead_comment = models.TextField(null=True, blank=True)

    rated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="consultant_rated_calls",
        on_delete=models.SET_NULL
    )
    rated_at = models.DateTimeField(null=True, blank=True)
    consultant_comment = models.TextField(null=True, blank=True)

    status = models.SmallIntegerField(choices=STATUS_CHOICES, default=1, db_index=True)

    tags = models.ManyToManyField(Tag, blank=True)

    rating_locked = models.BooleanField(default=False)
    rating_locked_at = models.DateTimeField(null=True, blank=True)

    attempt_on_time_stamp = models.DateTimeField(null=True,db_index=True)
    modified = models.DateTimeField(auto_now=True)

    def can_transition(self, new_status):
        return new_status in self.ALLOWED_TRANSITIONS.get(self.status, [])

    def update_status(self, new_status):
        if not self.can_transition(new_status):
            raise ValidationError("Invalid status transition")
        self.status = new_status
        self.save()

    def __str__(self):
        return self.uuid


# ------------------------
# EVALUATION CALL RATING
# ------------------------

class EvaluationCallRating(models.Model):
    call = models.ForeignKey(Call, on_delete=models.CASCADE, db_index=True)
    parameter = models.ForeignKey(EvaluationMetric, on_delete=models.CASCADE)
    rating = models.SmallIntegerField()
    rated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, db_index=True)

    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('call', 'parameter', 'rated_by')

    def clean(self):
        if not (self.parameter.min_value <= self.rating <= self.parameter.max_value):
            raise ValidationError("Rating out of allowed range")

    def __str__(self):
        return f"{self.call.uuid} - {self.parameter.name}"