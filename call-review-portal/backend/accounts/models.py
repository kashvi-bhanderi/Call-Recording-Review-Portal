from django.db import models

# Create your models here.
from django.contrib.auth.models import AbstractUser


class Language(models.Model):

    language = models.CharField(max_length=10, unique=True)
    language_name = models.CharField(max_length=100)

    def __str__(self):
        return self.language_name


class User(AbstractUser):

    ROLE_CHOICES = (
        (1, 'Consultant'),
        (2, 'Lead'),
    )

    role = models.SmallIntegerField(
    choices=ROLE_CHOICES,
    default=2
)
    accessible_languages = models.ManyToManyField(Language)

    created = models.DateTimeField(auto_now_add=True)