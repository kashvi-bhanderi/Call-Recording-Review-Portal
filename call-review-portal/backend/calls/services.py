from django.utils import timezone
from datetime import timedelta
from django.core.exceptions import ValidationError

LOCK_TIMEOUT = 10  # minutes


def acquire_lock(call, user):
    if call.rating_locked:
        if call.rating_locked_at and \
           timezone.now() - call.rating_locked_at < timedelta(minutes=LOCK_TIMEOUT):
            raise ValidationError("Call is currently locked")

    call.rating_locked = True
    call.rating_locked_at = timezone.now()
    call.reviewed_by = user
    call.save()


def release_lock(call):
    call.rating_locked = False
    call.rating_locked_at = None
    call.save()