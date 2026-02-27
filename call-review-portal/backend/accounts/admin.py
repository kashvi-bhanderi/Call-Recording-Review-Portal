from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.core.mail import send_mail

from .models import User, Language


# Register Language
admin.site.register(Language)


@admin.register(User)
class UserAdmin(BaseUserAdmin):

    list_display = (
        "id",
        "username",
        "email",
        "role",
        "is_active",
        "is_staff",
    )

    # Edit user form
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Custom Fields",
            {
                "fields": (
                    "role",
                    "accessible_languages",
                )
            },
        ),
    )

    #  Add user form 
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",      
                    "password1",
                    "password2",
                    "role",
                    "accessible_languages",
                ),
            },
        ),
    )


    # Send email when new user created
    def save_model(self, request, obj, form, change):

        is_new = obj.pk is None

        super().save_model(request, obj, form, change)

        if is_new:

            password = form.cleaned_data.get("password1")

            send_mail(
                subject="Your Call Review Portal Login Credentials",

                message=f"""
                Hello {obj.username},

                Your account has been created.

                Username: {obj.username}
                Password: {password}

                Login: http://localhost:5173
                """,

                from_email=None,

                recipient_list=[obj.email],

                fail_silently=False,
            )