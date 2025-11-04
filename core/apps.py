from django.apps import AppConfig


def _create_default_admin(sender, **kwargs):
    """Create a default superuser after migrations if none exists.

    Username/password can be overridden via env:
    - DEFAULT_ADMIN_USERNAME
    - DEFAULT_ADMIN_PASSWORD
    - DEFAULT_ADMIN_EMAIL
    """
    import os
    from django.contrib.auth import get_user_model

    User = get_user_model()

    # Only seed if there is no superuser yet
    if User.objects.filter(is_superuser=True).exists():
        return

    username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin").strip() or "admin"
    email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com").strip() or "admin@example.com"
    password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123").strip() or "admin123"

    # The custom User model requires `role`; set it explicitly.
    extra = {}
    try:
        extra["role"] = "admin"
    except Exception:
        pass

    # Create the superuser safely if username not taken
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username=username, email=email, password=password, **extra)
    else:
        # Ensure existing user has superuser/staff privileges
        u = User.objects.get(username=username)
        changed = False
        if not u.is_superuser:
            u.is_superuser = True
            changed = True
        if not u.is_staff:
            u.is_staff = True
            changed = True
        # Set role to admin if available
        if hasattr(u, "role") and getattr(u, "role") != "admin":
            try:
                u.role = "admin"
                changed = True
            except Exception:
                pass
        if changed:
            u.save()


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Ensure signal receivers are registered
        try:
            from . import signals  # noqa: F401
        except Exception:
            pass

        # Hook into post_migrate to seed a default admin once DB is ready
        try:
            from django.db.models.signals import post_migrate
            post_migrate.connect(_create_default_admin, sender=self)
        except Exception:
            # If migrations framework not available in this context, skip silently
            pass
