from django.db import models

# Create your models here.
from django.contrib.auth.models import AbstractUser


class Language(models.Model):

    language = models.CharField(max_length=10, unique=True)
    language_name = models.CharField(max_length=100)

    def __str__(self):
        return self.language_name
    
class Organization(models.Model): 
    schema_name = models.CharField(max_length=100, unique=True) # e.g. ad_0aa3ac etc 
    org_name = models.CharField(max_length=100, unique=True) # Human readable, e.g. Ujjivan 
    is_active = models.BooleanField(default=True) 
    
    def __str__(self): 
        return self.org_name

class User(AbstractUser):

    ROLE_CHOICES = (
        (1, 'Consultant'),
        (2, 'Lead'),
    )

    role = models.SmallIntegerField(
    choices=ROLE_CHOICES,
    default= 0,
)
    email = models.EmailField(unique=True)
    accessible_languages = models.ManyToManyField(Language)
    accessible_organizations = models.ManyToManyField(Organization)
    created = models.DateTimeField(auto_now_add=True)