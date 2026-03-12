from django.utils import timezone
from datetime import timedelta

LOCK_DURATION = timedelta(minutes=10)


def acquire_lock(call, user):
    """
    Lock call when lead opens it.
    """

    if call.rating_locked:

        expiry_time = call.rating_locked_at + LOCK_DURATION

        # expired lock
        if timezone.now() > expiry_time:
            call.rating_locked = False
            call.rating_locked_at = None
            call.save()
        else:
            raise Exception("Call already locked")

    call.rating_locked = True
    call.rating_locked_at = timezone.now()
    call.save()


def release_lock(call):
    """
    Release lock
    """
    call.rating_locked = False
    call.rating_locked_at = None
    call.save()


def check_lock_expiry(call):
    """
    Auto remove expired lock
    """
    if call.rating_locked:
        expiry = call.rating_locked_at + LOCK_DURATION

        if timezone.now() > expiry:
            call.rating_locked = False
            call.rating_locked_at = None
            call.save()