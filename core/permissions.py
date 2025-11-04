# core/permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS
from core.utils.auth import is_admin
from core.models import Menu, Section, Dish

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_admin(request.user)

class IsOwnerOrAdmin(BasePermission):
    """
    عامّة: تُستخدم مع كائنات تملك user مباشرًا (مثل Menu.user أو Section.user)
    أو عبر get_queryset المفلتر مسبقًا.
    """
    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True
        # Menu
        if isinstance(obj, Menu):
            return obj.user_id == request.user.id
        # Section
        if isinstance(obj, Section):
            return obj.menu.user_id == request.user.id
        # Dish
        if isinstance(obj, Dish):
            return obj.section.menu.user_id == request.user.id
        # افتراضي: للقراءة فقط إن لم نعرف النوع
        return request.method in SAFE_METHODS

class IsMenuOwnerOrAdmin(BasePermission):
    """للـ Views التي تتعامل مع menu_id في المسار/البارامز."""
    def has_permission(self, request, view):
        if is_admin(request.user):
            return True
        menu_id = getattr(view, "kwargs", {}).get("menu_id") or request.query_params.get("menu")
        if not menu_id:
            return True  # اترك الفلترة للـ queryset إذا لم يُمرَّر menu_id
        try:
            menu = Menu.objects.only("user_id").get(pk=menu_id)
            return (menu.user_id == request.user.id)
        except Menu.DoesNotExist:
            return False

class IsSectionOwnerOrAdmin(BasePermission):
    """للـ Views التي تتعامل مع section_id."""
    def has_permission(self, request, view):
        if is_admin(request.user):
            return True
        section_id = getattr(view, "kwargs", {}).get("section_id") or request.query_params.get("section")
        if not section_id:
            return True
        try:
            sec = Section.objects.select_related("menu").only("menu__user_id").get(pk=section_id)
            return (sec.menu.user_id == request.user.id)
        except Section.DoesNotExist:
            return False
