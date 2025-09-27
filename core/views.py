# core/views.py
# ============================================================
# واجهات REST الخاصة بالتطبيق
# ============================================================

from typing import Iterable, List, Dict
import re

from django.db import transaction, IntegrityError
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404

from rest_framework import generics, status, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    User,
    Menu,
    Section,
    Dish,
    MenuDisplaySettings,
    DishPrice,
    Profile,
    Ingredient,
    Allergen,   # لاستخدام M2M الأكواد
    DishAllergen,  # ⬅️ سجلات التتبّع لكل كود
)
from .serializers import (
    RegisterSerializer,
    MenuSerializer,
    SectionSerializer,
    DishSerializer,
    UserSerializer,
    PublicMenuSerializer,
    MenuDisplaySettingsSerializer,
    DishPriceSerializer,
    ProfileSerializer,
    DishAllergenSerializer,
)

# محرك القواعد
from core.services.allergen_rules import generate_for_dishes as rule_generate_for_dishes
from core.services.allergen_rules import normalize_text as _norm

# LLM
# LLM
from core.services.llm_ingest import (
    LLMConfig,
    llm_extract_terms,
    llm_map_terms_to_codes,
    llm_map_dish_to_codes,   # ← جديد: وضع LLM مباشر للأكواد
)
from core.llm_clients.openai_client import openai_caller

# نموذج القاموس
from core.dictionary_models import KeywordLexeme


# ============================================================
# Helpers
# ============================================================

def is_admin(user) -> bool:
    """تحقق صلاحية الأدمن (بحسب حقل role)."""
    return user.is_authenticated and getattr(user, "role", None) == "admin"


def _iter(iterable: Iterable):
    return iterable or []


def _merge_codes_str(*codes) -> str:
    """
    يدمج أكواد الحساسيّات كسلاسل ('A,G,K' ..) ويعيد سلسلة موحّدة مرتّبة (بدون تكرار).
    """
    bag = set()
    for c in codes:
        if not c:
            continue
        for p in re.split(r"[,\s]+", str(c).upper()):
            p = p.strip()
            if p:
                bag.add(p)
    return ",".join(sorted(bag)) if bag else ""


def _split_letter_codes(codes_str: str) -> List[str]:
    """تفكيك 'A,G,K,12' إلى ['A','G','K'] (يتجاهل الأرقام)."""
    out = []
    for p in re.split(r"[,\s]+", str(codes_str or "").strip().upper()):
        if len(p) == 1 and "A" <= p <= "Z":
            out.append(p)
    # إزالة التكرارات مع الحفاظ على ترتيب تقريبي
    seen = set()
    uniq = []
    for c in out:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq


@transaction.atomic
def _sync_dish_allergen_rows_from_codes(dish: Dish, codes_str: str, *, source: str = DishAllergen.Source.REGEX, force: bool = False) -> int:
    """
    يزامن سجلات DishAllergen من سلسلة أكواد حرفية (A,G,K).
    - لا يحذف السجلات اليدوية أو المؤكّدة.
    - إن لم يكن force: لا يلمس الأطباق ذات has_manual_codes=True.
    - يعيد عدد السجلات المُنشأة (الجديدة).
    """
    if (not force) and getattr(dish, "has_manual_codes", False):
        return 0

    codes = _split_letter_codes(codes_str)
    if not codes:
        return 0

    existing = set(DishAllergen.objects.filter(dish=dish).values_list("allergen__code", flat=True))
    to_add = [c for c in codes if c not in existing]
    if not to_add:
        return 0

    alls = {a.code: a for a in Allergen.objects.filter(code__in=to_add)}
    created = 0
    for code in to_add:
        allergen = alls.get(code)
        if not allergen:
            continue
        DishAllergen.objects.create(
            dish=dish,
            allergen=allergen,
            source=source,
            confidence=0.0,          # لاحقًا: نعبّيها من محرك القواعد
            rationale="",
            is_confirmed=False,
            created_by=None,
        )
        created += 1
    return created


# ============================================================
# Auth / Users
# ============================================================

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer


class UserListAdminView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        if not is_admin(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = User.objects.all().order_by("id")
        return Response(self.get_serializer(qs, many=True).data)


class UserDetailAdminView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if not is_admin(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().get(request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        if not is_admin(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        user_obj = self.get_object()
        if user_obj.username == "admin" and "is_active" in request.data:
            return Response({"detail": "لا يمكن تعطيل حساب admin الأساسي."}, status=status.HTTP_400_BAD_REQUEST)
        return super().patch(request, *args, **kwargs)


# ============================================================
# Profile
# ============================================================

class MeProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile


# ============================================================
# Menus / Sections / Dishes
# ============================================================

class MenuListCreateView(generics.ListCreateAPIView):
    serializer_class = MenuSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if is_admin(user):
            user_id = self.request.query_params.get("user")
            return Menu.objects.filter(user__id=user_id) if user_id else Menu.objects.all()
        return Menu.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MenuPublishView(generics.GenericAPIView):
    serializer_class = MenuSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        menu = get_object_or_404(Menu, pk=pk)
        if not (is_admin(request.user) or menu.user_id == request.user.id):
            return Response(status=status.HTTP_403_FORBIDDEN)
        menu.is_published = True
        if hasattr(menu, "ensure_public_slug"):
            menu.ensure_public_slug()
            menu.save(update_fields=["is_published", "public_slug"])
        else:
            menu.save(update_fields=["is_published"])
        return Response(MenuSerializer(menu).data, status=status.HTTP_200_OK)


class MenuUnpublishView(generics.GenericAPIView):
    serializer_class = MenuSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        menu = get_object_or_404(Menu, pk=pk)
        if not (is_admin(request.user) or menu.user_id == request.user.id):
            return Response(status=status.HTTP_403_FORBIDDEN)
        menu.is_published = False
        menu.save(update_fields=["is_published"])
        return Response(MenuSerializer(menu).data, status=status.HTTP_200_OK)


class MenuDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MenuSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Menu.objects.all() if is_admin(user) else Menu.objects.filter(user=user)


class SectionListCreateView(generics.ListCreateAPIView):
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        menu_id = self.request.query_params.get("menu")
        qs = Section.objects.all() if is_admin(user) else Section.objects.filter(menu__user=user)
        return qs.filter(menu_id=menu_id) if menu_id else qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DishListCreateView(generics.ListCreateAPIView):
    serializer_class = DishSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        section_id = self.request.query_params.get("section")
        base = (
            Dish.objects
            .select_related("section__menu__user__profile")
            .prefetch_related("prices", "allergen_rows__allergen")
        )
        qs = base if is_admin(user) else base.filter(section__menu__user=user)
        return qs.filter(section_id=section_id) if section_id else qs

    def perform_create(self, serializer):
        serializer.save()


class DishDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DishSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        base = (
            Dish.objects
            .select_related("section__menu__user__profile")
            .prefetch_related("prices", "allergen_rows__allergen")
        )
        return base if is_admin(user) else base.filter(section__menu__user=user)


# ============================================================
# Public Menu
# ============================================================

class PublicMenuView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicMenuSerializer
    lookup_field = "public_slug"

    def get_queryset(self):
        dishes_qs = (
            Dish.objects
            .select_related("section__menu__user__profile")
            .prefetch_related("prices", "allergen_rows__allergen")
        )
        return Menu.objects.filter(is_published=True).prefetch_related(
            "sections",
            Prefetch("sections__dishes", queryset=dishes_qs),
        )


# ============================================================
# Menu Display Settings
# ============================================================

class MenuDisplaySettingsDetail(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _check_perm(self, request, menu):
        return is_admin(request.user) or menu.user_id == request.user.id

    def get_object(self, request, menu_id):
        menu = get_object_or_404(Menu, pk=menu_id)
        if not self._check_perm(request, menu):
            return Response(status=status.HTTP_403_FORBIDDEN)
        settings_obj, _ = MenuDisplaySettings.objects.get_or_create(menu=menu)
        return settings_obj

    def get(self, request, menu_id):
        obj = self.get_object(request, menu_id)
        if isinstance(obj, Response):
            return obj
        ser = MenuDisplaySettingsSerializer(obj, context={"request": request})
        return Response(ser.data)

    def put(self, request, menu_id):
        obj = self.get_object(request, menu_id)
        if isinstance(obj, Response):
            return obj
        ser = MenuDisplaySettingsSerializer(obj, data=request.data, partial=True, context={"request": request})
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, menu_id):
        return self.put(request, menu_id)


# ============================================================
# v2 ViewSets
# ============================================================

class DishViewSet(viewsets.ModelViewSet):
    serializer_class = DishSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        base = (
            Dish.objects
            .select_related("section__menu__user__profile")
            .prefetch_related("prices", "allergen_rows__allergen")
        )
        if is_admin(user):
            section_id = self.request.query_params.get("section")
            return base.filter(section_id=section_id) if section_id else base
        base = base.filter(section__menu__user=user)
        section_id = self.request.query_params.get("section")
        return base.filter(section_id=section_id) if section_id else base


class DishPriceViewSet(viewsets.ModelViewSet):
    serializer_class = DishPriceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_dish(self):
        dish_id = self.kwargs["dish_pk"]
        dish = get_object_or_404(Dish, pk=dish_id)
        if not is_admin(self.request.user) and dish.section.menu.user_id != self.request.user.id:
            get_object_or_404(Dish, pk=-1)
        return dish

    def get_queryset(self):
        dish = self._get_dish()
        return DishPrice.objects.filter(dish=dish)

    def perform_create(self, serializer):
        dish = self._get_dish()
        serializer.save(dish=dish)

    def perform_update(self, serializer):
        instance = self.get_object()
        self._get_dish()
        serializer.save(dish=instance.dish)

    def perform_destroy(self, instance):
        self._get_dish()
        return super().perform_destroy(instance)


# ============================================================
#  Batch Generate Allergen Codes (Rules first, LLM fallback)
#  POST /api/dishes/batch-generate-allergen-codes/
# ============================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_generate_allergen_codes(request):
    """
    يولّد أكواد الحساسيّة/الإضافات:
      1) تشغيل محرك القواعد (قاموس DB).
      2) للأطباق التي بقيت بلا أكواد: LLM لاستخراج مصطلحات Zutaten،
         ويمكن (اختياريًا) تخمين أكواد لكل مصطلح. لا كتابة تلقائيّة.
      3) إن كان dry_run=false: نزامن سجلات DishAllergen بشكل محافظ من ناتج القواعد.
    """
    user = request.user

    # خيارات القواعد
    force = bool(request.data.get("force", False))
    dry_run = bool(request.data.get("dry_run", True))
    lang = (request.data.get("lang") or "de").lower()
    include_details = bool(request.data.get("include_details", True))

    # خيارات LLM
    use_llm = bool(request.data.get("use_llm", False))
    llm_dry_run = bool(request.data.get("llm_dry_run", True))
    llm_model = request.data.get("llm_model") or "gpt-4o-mini"
    llm_max_terms = int(request.data.get("llm_max_terms", 12))
    try:
        llm_temperature = float(request.data.get("llm_temperature", 0.2))
    except Exception:
        llm_temperature = 0.2
    llm_debug = bool(request.data.get("llm_debug", False))
    llm_guess_codes = bool(request.data.get("llm_guess_codes", True))

    # نطاق الأطباق
    base = Dish.objects.select_related("section__menu__user")
    qs = base if is_admin(user) else base.filter(section__menu__user=user)

    dish_ids = request.data.get("dish_ids")
    if isinstance(dish_ids, list) and dish_ids:
        qs = qs.filter(id__in=dish_ids)

    dishes = list(qs)

    # تحديد القاموس المستخدم (مالك واحد أو المستخدم الحالي)
    explicit_owner_id = request.data.get("owner_id")
    owner_id = None
    if explicit_owner_id is not None:
        try:
            owner_id = int(explicit_owner_id)
        except Exception:
            owner_id = None

    if owner_id is None:
        if not is_admin(user):
            owner_id = user.id
        else:
            owner_ids = {getattr(d.section.menu, "user_id", None) for d in dishes}
            owner_ids.discard(None)
            owner_id = next(iter(owner_ids)) if len(owner_ids) == 1 else None

    # 1) محرك القواعد
    rules_res = rule_generate_for_dishes(
        dishes,
        owner_id=owner_id,
        lang=lang,
        force=force,
        dry_run=dry_run,
        include_details=include_details,
    )

    # 1.b) مزامنة سجلات DishAllergen من ناتج القواعد (إن لم يكن dry_run)
    if not dry_run and isinstance(rules_res, dict):
        items = rules_res.get("items", []) or []
        by_id = {d.id: d for d in dishes}
        created_rows = 0
        for it in items:
            try:
                did = int(it.get("dish_id"))
            except Exception:
                continue
            dish = by_id.get(did)
            if not dish or bool(it.get("skipped")):
                continue
            after = (it.get("after") or "").strip()
            if not after:
                continue
            created_rows += _sync_dish_allergen_rows_from_codes(
                dish, after, source=DishAllergen.Source.REGEX, force=force
            )
        rules_res["dish_allergen_rows_created"] = created_rows

    # 2) LLM fallback
    missing_ids: List[int] = []
    for it in rules_res.get("items", []):
        after = (it.get("after") or "").strip()
        before = (it.get("before") or "").strip()
        if bool(it.get("skipped")):
            continue
        if after == "" or ((after == before) and (before == "")):
            missing_ids.append(int(it["dish_id"]))

    llm_payload = None
    if use_llm and missing_ids:
        by_id: Dict[int, Dish] = {d.id: d for d in dishes}
        cfg = LLMConfig(
            model_name=llm_model,
            lang=lang,
            max_terms=llm_max_terms,
            temperature=llm_temperature,
            dry_run=llm_dry_run,
            max_output_tokens=512,
        )

        items = []
        for did in missing_ids:
            d = by_id.get(did)
            if not d:
                continue

            try:
                if llm_debug:
                    terms, raw = llm_extract_terms(
                        openai_caller, cfg, d.name or "", d.description or "", return_raw=True  # type: ignore
                    )
                else:
                    terms = llm_extract_terms(openai_caller, cfg, d.name or "", d.description or "")  # type: ignore
                    raw = ""
            except Exception as e:
                items.append({
                    "dish_id": did,
                    "status": "error",
                    "error": str(e),
                    "reused": False,
                    "candidates": [],
                })
                continue

            # تخمين أكواد لكل term (اختياريًا)
            codes_lookup = {}
            if llm_guess_codes and terms:
                try:
                    codes_lookup = llm_map_terms_to_codes(openai_caller, cfg, terms, lang=lang)
                except Exception:
                    codes_lookup = {}

            candidates = []
            for term in terms:
                lk = codes_lookup.get(term.lower(), {}) if isinstance(codes_lookup, dict) else {}
                cand = {
                    "term": term,
                    "guess_codes": lk.get("codes", ""),
                    "confidence": lk.get("confidence", 0.0),
                    "reason": lk.get("reason", ""),
                }

                # هل المصطلح موجود لدينا في أي قاموس ويرتبط بمكوّن معروف؟
                norm = _norm(term)
                lx = (
                    KeywordLexeme.objects
                    .filter(lang=lang, normalized_term=norm)
                    .select_related("ingredient")
                    .first()
                )
                if lx and lx.ingredient_id:
                    cand["mapped_ingredient_id"] = lx.ingredient_id

                candidates.append(cand)

            item = {
                "dish_id": did,
                "status": "ok" if terms else "empty",
                "reused": False,
                "candidates": candidates,
            }
            if llm_debug:
                item["raw"] = raw
            items.append(item)

        llm_payload = {
            "count": len(items),
            "items": items[:1000],
            "dry_run": llm_dry_run,
            "model_name": cfg.model_name,
            "lang": cfg.lang,
            "note": "LLM candidates only; review & add lexemes to map terms → ingredients. Includes guess_codes.",
        }

    return Response({"rules": rules_res, "llm": llm_payload}, status=status.HTTP_200_OK)


# ============================================================
# Dictionary: Batch Upsert (آمن)
# POST /api/dictionary/batch-upsert-lexemes/
# ============================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def dictionary_batch_upsert_lexemes(request):
    """
    يضيف/يحدّث Lexemes على قاموس آمن.
    - المستخدم العادي: دائمًا على قاموسه (لا يُسمح بتمرير owner_id).
    - الأدمن: يجب تمرير owner_id صراحةً.
    """
    data = request.data or {}
    lang = (data.get("lang") or "de").lower()
    items = data.get("items") or []
    as_ingredient = bool(data.get("as_ingredient", True))

    if not isinstance(items, list):
        return Response({"detail": "items must be a list."}, status=status.HTTP_400_BAD_REQUEST)

    # تحديد المالك بشكل آمن
    if is_admin(request.user):
        eff_owner_id = data.get("owner_id")
        if eff_owner_id is None:
            return Response({"detail": "owner_id is required for admin."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            eff_owner_id = int(eff_owner_id)
        except Exception:
            return Response({"detail": "owner_id must be an integer."}, status=status.HTTP_400_BAD_REQUEST)
    else:
        eff_owner_id = request.user.id

    owner_user = get_object_or_404(User, pk=eff_owner_id)

    created = 0
    updated = 0
    out_items = []

    for raw in items:
        term = (raw.get("term") or "").strip()
        if not term:
            continue

        ing_name = (raw.get("ingredient_name") or raw.get("name") or "").strip()
        codes_str = (raw.get("allergen_codes") or raw.get("codes") or "").strip().upper()
        codes_set = {c for c in re.split(r"[,\s]+", codes_str) if c}

        # upsert lexeme بمفتاح (owner, lang, normalized_term)
        norm = _norm(term)
        lx = (
            KeywordLexeme.objects
            .filter(owner_id=eff_owner_id, lang__iexact=lang, normalized_term=norm)
            .first()
        )

        if lx is None:
            lx = KeywordLexeme(owner=owner_user, lang=lang, term=term, normalized_term=norm, is_active=True)
            lx.save()
            created += 1
        else:
            # حدّث المصطلح الظاهر وفعّله
            changed = False
            if lx.term != term:
                lx.term = term
                changed = True
            if not lx.is_active:
                lx.is_active = True
                changed = True
            if changed:
                lx.save(update_fields=["term", "is_active"])
                updated += 1

        # ingredient (اختياري)
        if as_ingredient and ing_name:
            ing = Ingredient.objects.filter(owner_id=eff_owner_id, name__iexact=ing_name).first()
            if ing is None:
                ing = Ingredient.objects.create(owner=owner_user, name=ing_name)
            if lx.ingredient_id != ing.id:
                lx.ingredient = ing
                lx.save(update_fields=["ingredient"])

            # إذا أُرسلت أكواد؛ حدّث مكوّن/lexeme بالأكواد (M2M على Allergen)
            if codes_set:
                ing_existing = set(ing.allergens.values_list("code", flat=True))
                union = sorted(ing_existing | codes_set)
                if set(union) != ing_existing:
                    alls = list(Allergen.objects.filter(code__in=union))
                    ing.allergens.set(alls)

                # كذلك على lexeme نفسه (حتى لو مربوط بمكوّن)
                lx_existing = set(lx.allergens.values_list("code", flat=True))
                if codes_set - lx_existing:
                    lx_all = list(Allergen.objects.filter(code__in=sorted(lx_existing | codes_set)))
                    lx.allergens.set(lx_all)

        elif codes_set:
            # بدون ingredient: خزّن الأكواد على lexeme مباشرة
            existing = set(lx.allergens.values_list("code", flat=True))
            if codes_set - existing:
                alls = list(Allergen.objects.filter(code__in=sorted(existing | codes_set)))
                lx.allergens.set(alls)

        out_items.append({
            "id": lx.id,
            "term": lx.term,
            "ingredient_id": lx.ingredient_id,
            "codes": ",".join(sorted(lx.allergens.values_list("code", flat=True))),
        })

    return Response({
        "owner_id": eff_owner_id,
        "lang": lang,
        "created": created,
        "updated": updated,
        "items": out_items,
    }, status=status.HTTP_200_OK)


# ============================================================
# (اختياري) حفظ سريع من LLM لقاموس المستخدم الحالي
# POST /api/dictionary/llm-add-terms/
# ============================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def llm_add_terms_to_lexicon(request):
    """
    يحفظ مصطلحات مقترحة من LLM لقاموس المستخدم الحالي.
    للأدمن فقط: as_global=true يحفظ في القاموس العام (owner=None).
    """
    user = request.user
    is_admin_user = is_admin(user)

    data = request.data or {}
    lang = (data.get("lang") or "de").lower().strip()
    items = data.get("items") or []
    as_global = bool(data.get("as_global", False)) if is_admin_user else False

    results = []
    created = 0
    updated = 0
    skipped = 0

    for it in items:
        term = (it.get("term") or "").strip()
        codes_in = (it.get("allergen_codes") or it.get("codes") or "").strip()
        if not term:
            results.append({"term": term, "status": "error", "reason": "empty_term"})
            skipped += 1
            continue

        codes_norm = _merge_codes_str(codes_in)
        norm = _norm(term)

        qs = KeywordLexeme.objects.filter(lang__iexact=lang, normalized_term=norm)
        qs = qs.filter(owner__isnull=True) if as_global else qs.filter(owner=user)

        obj = qs.first()
        if obj:
            if codes_norm:
                existing = ",".join(sorted(obj.allergens.values_list("code", flat=True)))
                merged = _merge_codes_str(existing, codes_norm)
                if merged != existing:
                    alls = list(Allergen.objects.filter(code__in=re.split(r"[,\s]+", merged)))
                    obj.allergens.set(alls)
                    obj.is_active = True
                    obj.save(update_fields=["is_active"])
                    updated += 1
                    results.append({"term": term, "id": obj.id, "status": "updated"})
                else:
                    skipped += 1
                    results.append({"term": term, "id": obj.id, "status": "exists"})
            else:
                skipped += 1
                results.append({"term": term, "id": obj.id, "status": "exists"})
            continue

        # إنشاء جديد
        create_kwargs = {
            "term": term,
            "lang": lang,
            "is_regex": False,
            "is_active": True,
            "normalized_term": norm,
        }
        if as_global:
            obj = KeywordLexeme.objects.create(**create_kwargs)
        else:
            obj = KeywordLexeme.objects.create(owner=user, **create_kwargs)

        if codes_norm:
            alls = list(Allergen.objects.filter(code__in=re.split(r"[,\s]+", codes_norm)))
            obj.allergens.set(alls)

        created += 1
        results.append({"term": term, "id": obj.id, "status": "created"})

    return Response({
        "ok": True,
        "lang": lang,
        "as_global": as_global,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "items": results[:1000],
        "note": "Saved into user's private lexicon unless admin + as_global=true.",
    }, status=status.HTTP_200_OK)


# ============================================================
# DishAllergen CRUD (nested-friendly + bulk actions)
#  /api/v2/dishes/<dish_pk>/allergens/...
#  أو: /api/dish-allergens/?dish=<id> (بدون nested)
# ============================================================

class DishAllergenViewSet(viewsets.ModelViewSet):
    """
    CRUD كامل لسجلات الحساسية على الطبق مع:
      - احترام صلاحيات المالك/الأدمن
      - دعم nested (dish_pk) أو query param (?dish=)
      - تعيين created_by تلقائيًا
      - أكشنات bulk للتأكيد/إلغاء التأكيد
      - إدخال سريع من رموز ('A,G,K') يدويًا
    """
    serializer_class = DishAllergenSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_dish_from_context(self):
        """يجلب الطبق من dish_pk (nested) أو من query/body مع فحص الصلاحيات."""
        user = self.request.user
        dish_pk = self.kwargs.get("dish_pk")
        dish_id = None

        if dish_pk:
            dish_id = dish_pk
        elif self.request.method in ("POST", "PUT", "PATCH"):
            dish_id = self.request.data.get("dish") or self.request.data.get("dish_id")
        else:
            dish_id = self.request.query_params.get("dish")

        if not dish_id:
            return None

        dish = get_object_or_404(Dish, pk=dish_id)
        if not is_admin(user) and dish.section.menu.user_id != user.id:
            get_object_or_404(Dish, pk=-1)  # 403 مبطن
        return dish

    def get_queryset(self):
        user = self.request.user
        qs = DishAllergen.objects.select_related("dish", "allergen", "dish__section__menu__user")
        # دعم nested أو ?dish=
        dish = self._get_dish_from_context()
        if dish:
            qs = qs.filter(dish=dish)
        if is_admin(user):
            return qs
        return qs.filter(dish__section__menu__user=user)

    # --------- Create / Update / Delete ---------

    def create(self, request, *args, **kwargs):
        dish = self._get_dish_from_context()
        if dish is None:
            return Response({"detail": "dish is required."}, status=status.HTTP_400_BAD_REQUEST)

        # نحقن dish و created_by
        data = request.data.copy()
        data["dish"] = dish.id

        # تطبيع confidence ضمن [0..1] لو أُرسل
        try:
            if "confidence" in data and data["confidence"] is not None:
                c = float(data["confidence"])
                data["confidence"] = max(0.0, min(1.0, c))
        except Exception:
            data["confidence"] = 0.0

        ser = self.get_serializer(data=data)
        ser.is_valid(raise_exception=True)

        try:
            obj = ser.save(created_by=request.user)
        except IntegrityError:
            return Response({"detail": "Allergen already exists for this dish."}, status=status.HTTP_400_BAD_REQUEST)

        headers = self.get_success_headers(ser.data)
        # نعيد السجل المخلوق
        out = self.get_serializer(obj).data
        return Response(out, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        # منع نقل السجل إلى طبق آخر إن كان nested
        dish = self._get_dish_from_context()
        if dish:
            serializer.save(dish=dish)
        else:
            serializer.save()

    def destroy(self, request, *args, **kwargs):
        # صلاحيات متحققة عبر get_queryset
        return super().destroy(request, *args, **kwargs)

    # --------- Bulk Actions ---------

    @action(detail=False, methods=["POST"])
    def bulk_confirm(self, request, *args, **kwargs):
        """
        تأكيد مجموعة سجلات: { "ids": [1,2,3], "is_confirmed": true }
        """
        ids = request.data.get("ids") or []
        is_confirmed = bool(request.data.get("is_confirmed", True))
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)

        qs = self.get_queryset().filter(id__in=ids)
        updated = qs.update(is_confirmed=is_confirmed)
        return Response({"updated": updated, "is_confirmed": is_confirmed})

    @action(detail=False, methods=["POST"])
    def add_codes(self, request, *args, **kwargs):
        """
        إدخال سريع من رموز حرفية للطبق الحالي:
        - nested: /v2/dishes/<dish_pk>/allergens/add_codes/
        - body: { "codes": "A,G,K", "confirm": true }
        """
        dish = self._get_dish_from_context()
        if dish is None:
            return Response({"detail": "dish is required."}, status=status.HTTP_400_BAD_REQUEST)

        codes_str = (request.data.get("codes") or "").strip()
        confirm = bool(request.data.get("confirm", True))
        codes = _split_letter_codes(codes_str)
        if not codes:
            return Response({"detail": "No valid letter codes."}, status=status.HTTP_400_BAD_REQUEST)

        existing = set(DishAllergen.objects.filter(dish=dish).values_list("allergen__code", flat=True))
        to_add = [c for c in codes if c not in existing]
        alls = {a.code: a for a in Allergen.objects.filter(code__in=to_add)}
        created = 0
        created_ids = []
        for code in to_add:
            allergen = alls.get(code)
            if not allergen:
                continue
            obj = DishAllergen.objects.create(
                dish=dish,
                allergen=allergen,
                source=DishAllergen.Source.MANUAL,
                confidence=1.0 if confirm else 0.8,
                rationale="Manual entry",
                is_confirmed=confirm,
                created_by=request.user,
            )
            created += 1
            created_ids.append(obj.id)

        return Response({"created": created, "ids": created_ids, "codes": ",".join(to_add)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def llm_direct_codes(request):
    """
    يطلب من LLM إرجاع الأكواد مباشرة من الاسم+الوصف (بدون المرور بالقواعد/القاموس).
    يعيد: {"codes": "A,C,G", "raw": "..."} — codes قد تكون فارغة إن لم يجد ما يكفي من قرائن.
    """
    data = request.data or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    model = (data.get("model") or data.get("llm_model") or "gpt-4o-mini").strip()

    # temperature اختياري — إفتراضي محافظ 0.2
    try:
        temperature = float(data.get("temperature", data.get("llm_temperature", 0.2)))
    except Exception:
        temperature = 0.2

    cfg = LLMConfig(
        model_name=model,
        lang="de",
        max_terms=12,
        temperature=temperature,
        dry_run=True,
        max_output_tokens=256,
        timeout=60,
    )

    try:
        res = llm_map_dish_to_codes(openai_caller, cfg, name, description)  # type: ignore
        return Response({"ok": True, **res}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"ok": False, "error": str(e)}, status=status.HTTP_200_OK)



# ========================= END =========================
