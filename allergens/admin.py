# allergens/admin.py
from django.contrib import admin
from .models import AllergenCode

@admin.register(AllergenCode)
class AllergenCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "name_de", "name_en", "is_active", "created_at")
    list_filter  = ("is_active",)
    search_fields = ("code", "name_de", "name_en")
    ordering = ("code",)
