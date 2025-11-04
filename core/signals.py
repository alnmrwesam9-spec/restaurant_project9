# core/signals.py
# -----------------------------------------------------------------------------
# Django signals:
# 1) ensure_profile: إنشاء Profile تلقائيًا للمستخدم الجديد.
# 2) image_cleaners (pre_save): تنظيف صور Dish/Profile/MenuDisplaySettings قبل الحفظ.
# -----------------------------------------------------------------------------

from django.conf import settings
from django.core.files.base import ContentFile
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from core.utils.images import validate_and_clean_image
from core.models import Dish, Profile, MenuDisplaySettings


# -----------------------------------------------------------------------------
# 1) Ensure a profile exists for every user
# -----------------------------------------------------------------------------
@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.get_or_create(user=instance)


# -----------------------------------------------------------------------------
# 2) Image cleaners
# -----------------------------------------------------------------------------
def _clean_field_if_needed(instance, field_name: str) -> None:
    """Clean Image/File field at model layer as a safety net.
    Skip if the serializer already produced a cleaned ContentFile.
    """
    file = getattr(instance, field_name, None)
    if not file:
        return

    # Skip if already cleaned in serializer (marked on ContentFile)
    try:
        inner = getattr(file, "file", None)
        if getattr(file, "_cleaned_image", False) or getattr(inner, "_cleaned_image", False):
            return
    except Exception:
        pass

    cleaned: ContentFile = validate_and_clean_image(file)
    getattr(instance, field_name).save(cleaned.name, cleaned, save=False)


@receiver(pre_save, sender=Dish)
def dish_image_cleaner(sender, instance: Dish, **kwargs):
    if instance and getattr(instance, "image", None):
        _clean_field_if_needed(instance, "image")


@receiver(pre_save, sender=Profile)
def profile_avatar_cleaner(sender, instance: Profile, **kwargs):
    if instance and getattr(instance, "avatar", None):
        _clean_field_if_needed(instance, "avatar")


@receiver(pre_save, sender=MenuDisplaySettings)
def menu_display_images_cleaner(sender, instance: MenuDisplaySettings, **kwargs):
    if not instance:
        return
    if getattr(instance, "logo", None):
        _clean_field_if_needed(instance, "logo")
    if getattr(instance, "hero_image", None):
        _clean_field_if_needed(instance, "hero_image")

