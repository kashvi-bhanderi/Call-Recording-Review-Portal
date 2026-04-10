from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

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
class CallCH(models.Model):

    uuid = models.TextField(primary_key=True)
    schema_name = models.TextField()
    phone_number = models.TextField()
    template_id = models.IntegerField()
    duration = models.IntegerField(null=True)
    language = models.TextField()
    attempt_on_time_stamp = models.DateTimeField()
    entities = models.JSONField(null=True, blank=True) 
    turns = models.IntegerField(default=0)
    class Meta:
        managed = False
        db_table = "cai_call"

class CallTurnwiseCH(models.Model):
    uuid = models.TextField()
    round = models.IntegerField()
    stt_output = models.TextField(null=True, blank=True)
    tts_input = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "cai_turnwise_call"
        unique_together = ('uuid', 'round')

class Call(models.Model):

    STATUS_CHOICES = (
        (1, "Not Rated"),
        (2, "Rated"),
        (3, "Production Issue"),
        (4, "Approved"),
    )


    uuid = models.TextField(unique=True, db_index=True)
    
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
    good_audio_to_share = models.BooleanField(null=True, blank=True)
    tags = models.ManyToManyField(Tag, blank=True)

    rating_locked = models.BooleanField(default=False)
    rating_locked_at = models.DateTimeField(null=True, blank=True)

    attempt_on_time_stamp = models.DateTimeField(null=True,db_index=True)
    modified = models.DateTimeField(auto_now=True)


    def update_status(self, new_status):
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
        
    def save(self, *args, **kwargs):
        self.full_clean()   # this calls clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.call.uuid} - {self.parameter.name}"
    

class EntityDefinition(models.Model):
   DATA_TYPES = [
       ("string", "String"),
       ("number", "Number"),
       ("date", "Date"),
       ("boolean", "Boolean"),
       ("time", "Time"),
   ]


   key = models.CharField(max_length=255, unique=True)
   data_type = models.CharField(max_length=50, choices=DATA_TYPES)


   def __str__(self):
       return f"{self.key} ({self.data_type})"