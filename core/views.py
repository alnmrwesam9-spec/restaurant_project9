# core/views.py
# ============================================================
# واجهات REST الخاصة بالتطبيق
# ============================================================

from typing import Iterable, List, Dict
import re
import time
import logging

from django.db import transaction, IntegrityError
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from rest_framework import generics, status, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes, action, throttle_classes
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import RetrieveUpdateAPIView, ListAPIView
from rest_framework.exceptions import PermissionDenied, ValidationError

from core.utils.auth import is_admin
from core.permissions import IsAdmin

from .models import (
    User,
    Menu,
    Section,
    Dish,
    MenuDisplaySettings,
    DishPrice,
    Profile,
    DishAllergen,
)

from core.models import Allergen, Ingredient

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
    KeywordLexemeSerializer,   # بديل LexemeSerializer
)

# محرك القواعد
from core.services.allergen_rules import generate_for_dishes as rule_generate_for_dishes
from core.services.allergen_rules import normalize_text as _norm

# LLM
from core.services.llm_ingest import (
    LLMConfig,
    llm_extract_terms,
    llm_map_terms_to_codes,
    llm_map_dish_to_codes,   # LLM مباشر للأكواد
)
from core.llm_clients.openai_client import openai_caller
from core.llm_clients.limiter import estimate_eta as _llm_estimate_eta
from core.llm_clients.limiter import global_limiter as _llm_limiter
from core.utils.jobs import job_manager, JobState

logger = logging.getLogger("core.llm")

# نموذج القاموس
from core.dictionary_models import KeywordLexeme, normalize_text

User = get_user_model()

# ============================================================
# Helpers
# ============================================================

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


# ================== NEW helper for LLM code extraction ==================

CODE_RE = re.compile(r"(?:[A-R]|E?\d{3,4})", re.IGNORECASE)


def _extract_codes_str(codes_in: str) -> str:
    """
    يأخذ سترينغ مثل 'G, K, E330' أو '%0=… G, K, E330'
    ويرجّع 'G,K,E330' بعد التنظيف وبدون تكرار.
    """
    if not codes_in:
        return ""
    raw = str(codes_in)
    tokens = CODE_RE.findall(raw)
    cleaned = []
    seen = set()
    for t in tokens:
        t = t.upper().strip()
        if not t:
            continue
        if t not in seen:
            seen.add(t)
            cleaned.append(t)
    return ",".join(cleaned)


@transaction.atomic
def _sync_dish_allergen_rows_from_codes(
    dish: Dish,
    codes_str: str,
    *,
    source: str = DishAllergen.Source.REGEX,
    force: bool = False
) -> int:
    """
    يزامن سجلات DishAllergen من سلسلة أكواد حرفية (A,G,K).
    - لا يحذف السجلات اليدوية أو المؤكّدة.
    - إن لم يكن force: لا يلمس الأطباق ذات has_manual_codes=True.
    - يعيد عدد السجلات المُنشأة (الجديدة).
    """
    if (not force) and getattr(dish, "has_manual_codes", False):
        return 0

    # Robustly extract letter codes A..R from any formatted string like '(A,G,12)'
    tokens = re.findall(r"(?i)\b([A-R])\b", str(codes_str or ""))
    codes = []
    for c in tokens:
        cu = (c or "").upper()
        if cu and cu not in codes:
            codes.append(cu)
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

class WhoAmI(APIView):
    """
    GET /api/auth/whoami
    يعيد معلومات المستخدم الحالي إذا كان موثقًا.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        data = {
            "id": getattr(u, "id", None),
            "username": getattr(u, "username", ""),
            "email": getattr(u, "email", ""),
            "is_staff": getattr(u, "is_staff", False),
            "role": getattr(u, "role", None),
            "is_authenticated": bool(u.is_authenticated),
        }
        return Response(data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def ping(request):
    """
    GET /api/ping
    فحص سريع للتأكد من أن الـ API يعمل.
    """
    return Response({"ok": True, "ping": "pong"}, status=status.HTTP_200_OK)


# ============================================================
# LLM ETA / Limits helpers (for UI progress & estimates)
# ============================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def llm_eta(request):
    """
    GET /api/llm/eta?count=100&avg_tokens=1500&calls_per_item=2.0&p95_latency_sec=2.5
    Returns an ETA estimate (in minutes) and the effective throughput.
    """
    try:
        count = int(request.query_params.get("count", 0))
    except Exception:
        count = 0
    try:
        avg_tokens = int(request.query_params.get("avg_tokens", 1500))
    except Exception:
        avg_tokens = 1500
    try:
        calls_per_item = float(request.query_params.get("calls_per_item", 2.0))
    except Exception:
        calls_per_item = 2.0
    try:
        p95_latency = float(request.query_params.get("p95_latency_sec", 2.5))
    except Exception:
        p95_latency = 2.5

    rate, minutes = _llm_estimate_eta(
        items=count,
        avg_tokens_per_call=avg_tokens,
        calls_per_item=calls_per_item,
        p95_latency_sec=p95_latency,
    )

    # timing: end of rules phase
    t_rules_end = time.monotonic()
    try:
        logger.info("rules_phase: dishes=%d sec=%.3f", len(dishes), (t_rules_end - t_rules_start))
    except Exception:
        pass
    return Response({
        "count": count,
        "avg_tokens_per_call": avg_tokens,
        "calls_per_item": calls_per_item,
        "p95_latency_sec": p95_latency,
        "effective_rate_req_per_min": round(rate, 2),
        "estimated_minutes": round(minutes, 2),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def llm_limits(request):
    """
    GET /api/llm/limits -> current limiter config + runtime budgets & simple throughput.
    Useful to show the user remaining capacity and a live-progress ticker.
    """
    data = {
        "config": _llm_limiter.config(),
        "stats": _llm_limiter.stats(),
    }
    return Response(data, status=status.HTTP_200_OK)


# ============================================================
# LLM Batch Jobs (async): start + status
# ============================================================

def _run_batch_generate_job(job: JobState, user_id: int, payload: dict) -> Dict:
    t_job_start = time.monotonic()
    # Reuse logic from batch_generate_allergen_codes while updating job progress
    from django.contrib.auth import get_user_model
    UserModel = get_user_model()
    user = UserModel.objects.filter(pk=user_id).first()
    if not user:
        raise RuntimeError("User not found for job")

    # Parse payload (mirror sync endpoint)
    force = bool(payload.get("force", False))
    dry_run = bool(payload.get("dry_run", True))
    lang = str(payload.get("lang") or "de").lower()
    include_details = bool(payload.get("include_details", True))

    use_llm = bool(payload.get("use_llm", False))
    llm_dry_run = bool(payload.get("llm_dry_run", True))
    llm_model = payload.get("llm_model") or "gpt-4o-mini"
    try:
        llm_max_terms = int(payload.get("llm_max_terms", 12))
    except Exception:
        llm_max_terms = 12
    try:
        llm_temperature = float(payload.get("llm_temperature", 0.2))
    except Exception:
        llm_temperature = 0.2
    llm_debug = bool(payload.get("llm_debug", False))
    llm_guess_codes = bool(payload.get("llm_guess_codes", True))

    # Query dishes with same permission constraints
    base = Dish.objects.select_related("section__menu__user")
    qs = base if is_admin(user) else base.filter(section__menu__user=user)
    dish_ids_param = payload.get("dish_ids")
    if isinstance(dish_ids_param, list) and dish_ids_param:
        qs = qs.filter(id__in=dish_ids_param)
    dishes = list(qs)

    total_units = len(dishes)
    job_manager.update(job.id, total=total_units, completed=0, message="rules phase")

    # Determine owner_id as in sync endpoint
    owner_id = None
    explicit_owner_id = payload.get("owner_id")
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

    # timing: rules phase
    t_rules_start = time.monotonic()

    # 1) Rules — always include the caller's private lexicon along with owner's/global
    rules_res = rule_generate_for_dishes(
        dishes,
        owner_id=owner_id,
        lang=lang,
        force=force,
        dry_run=dry_run,
        include_details=include_details,
        extra_owner_ids=[user.id],
    )

    # 1.b) Persist DishAllergen rows if not dry_run
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

    # Mark phase 1 progress
    job_manager.update(job.id, completed=len(dishes), message="rules done")

    # 2) LLM fallback
    missing_ids: List[int] = []
    for it in rules_res.get("items", []):
        after = (it.get("after") or "").strip()
        before = (it.get("before") or "").strip()
        if bool(it.get("skipped")):
            continue
        if after == "" or ((after == before) and (before == "")):
            try:
                missing_ids.append(int(it["dish_id"]))
            except Exception:
                continue

    llm_payload = None
    if use_llm and missing_ids:
        by_id = {d.id: d for d in dishes}
        cfg = LLMConfig(
            model_name=llm_model,
            lang=lang,
            max_terms=llm_max_terms,
            temperature=llm_temperature,
            dry_run=llm_dry_run,
            max_output_tokens=512,
        )

        # Increase total units by remaining LLM work
        total_units2 = len(dishes) + len(missing_ids)
        job_manager.update(job.id, total=total_units2, message="llm phase")

        items = []
        total_llm = len(missing_ids)
        processed_llm = 0
        calls_per_item = 1.0 + (1.0 if llm_guess_codes else 0.0)

        for did in missing_ids:
            # cooperative cancellation: bail out with partial results
            if job_manager.is_cancel_requested(job.id):
                partial = {
                    "rules": rules_res,
                    "llm": {
                        "count": len(items),
                        "items": items[:1000],
                        "dry_run": llm_dry_run,
                        "model_name": cfg.model_name,
                        "lang": cfg.lang,
                        "note": "Cancelled by user; partial items included.",
                    },
                }
                job_manager.cancelled(job.id, partial_result=partial)
                return partial
            d = by_id.get(did)
            if not d:
                continue
            try:
                t_extr_start = time.monotonic()
                if llm_debug:
                    terms, raw = llm_extract_terms(openai_caller, cfg, d.name or "", d.description or "", return_raw=True)  # type: ignore
                else:
                    terms = llm_extract_terms(openai_caller, cfg, d.name or "", d.description or "")  # type: ignore
                    raw = ""
                t_extr_end = time.monotonic()
                try:
                    logger.info(
                        "llm_extract_terms: dish_id=%s name_len=%d desc_len=%d terms=%d sec=%.3f",
                        did,
                        len(d.name or ""),
                        len(d.description or ""),
                        len(terms) if isinstance(terms, list) else 0,
                        (t_extr_end - t_extr_start),
                    )
                except Exception:
                    pass
            except Exception as e:
                items.append({
                    "dish_id": did,
                    "status": "error",
                    "error": str(e),
                    "reused": False,
                    "candidates": [],
                })
                processed_llm += 1
                job_manager.update(job.id, completed=len(dishes) + processed_llm)
                # update ETA for remaining llm items
                remain = max(0, total_llm - processed_llm)
                _, eta_min = _llm_estimate_eta(remain, avg_tokens_per_call=1500, calls_per_item=calls_per_item)
                job_manager.update(job.id, eta_minutes=eta_min)
                continue

            codes_lookup = {}
            if llm_guess_codes and terms:
                try:
                    t_map_start = time.monotonic()
                    codes_lookup = llm_map_terms_to_codes(openai_caller, cfg, terms, lang=lang)
                    t_map_end = time.monotonic()
                    try:
                        logger.info(
                            "llm_map_terms_to_codes: dish_id=%s term_count=%d sec=%.3f",
                            did,
                            len(terms) if isinstance(terms, list) else 0,
                            (t_map_end - t_map_start),
                        )
                    except Exception:
                        pass
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

            processed_llm += 1
            job_manager.update(job.id, completed=len(dishes) + processed_llm)
            remain = max(0, total_llm - processed_llm)
            _, eta_min = _llm_estimate_eta(remain, avg_tokens_per_call=1500, calls_per_item=calls_per_item)
            job_manager.update(job.id, eta_minutes=eta_min)

        llm_payload = {
            "count": len(items),
            "items": items[:1000],
            "dry_run": llm_dry_run,
            "model_name": cfg.model_name,
            "lang": cfg.lang,
            "note": "LLM candidates only; review & add lexemes to map terms → ingredients. Includes guess_codes.",
        }

    # total timing
    t_job_end = time.monotonic()
    try:
        logger.info(
            "llm_job_total: dishes=%d missing_after_rules=%d sec=%.3f",
            len(dishes), len(missing_ids), (t_job_end - t_job_start)
        )
    except Exception:
        pass
    return {"rules": rules_res, "llm": llm_payload}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def llm_jobs_start_batch_generate(request):
    # Prepare payload copy
    payload = dict(request.data) if hasattr(request, "data") else {}

    # Compute initial dish count for total estimate
    user = request.user
    base = Dish.objects.select_related("section__menu__user")
    qs = base if is_admin(user) else base.filter(section__menu__user=user)
    dish_ids_param = payload.get("dish_ids")
    if isinstance(dish_ids_param, list) and dish_ids_param:
        qs = qs.filter(id__in=dish_ids_param)
    initial_count = qs.count()

    job = job_manager.create(total=initial_count, message="queued")
    job_manager.spawn(job, _run_batch_generate_job, user.id, payload)

    # rough ETA (LLM-only), assume at most 2 calls/item if llm enabled
    use_llm = bool(payload.get("use_llm", False))
    calls_per_item = 2.0 if use_llm else 0.0
    _, eta_min = _llm_estimate_eta(initial_count, avg_tokens_per_call=1500, calls_per_item=calls_per_item)

    return Response({
        "job_id": job.id,
        "queued": True,
        "initial_total": initial_count,
        "initial_eta_minutes": round(eta_min, 2) if eta_min else 0.0,
    }, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def llm_jobs_status(request, job_id: str):
    st = job_manager.get(job_id)
    if not st:
        return Response({"detail": "job not found"}, status=status.HTTP_404_NOT_FOUND)

    def _ts(x):
        import datetime
        return datetime.datetime.utcfromtimestamp(x).isoformat() + "Z" if x else None

    data = {
        "id": st.id,
        "status": st.status,
        "message": st.message,
        "created_at": _ts(st.created_at),
        "started_at": _ts(st.started_at),
        "finished_at": _ts(st.finished_at),
        "total": st.total,
        "completed": st.completed,
        "percent": round(st.percent, 2),
        "eta_minutes": round(st.eta_minutes, 2) if st.eta_minutes is not None else None,
        "error": st.error,
        "result": st.result if st.status == "done" else None,
    }
    return Response(data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def llm_jobs_cancel(request, job_id: str):
    """
    POST /api/llm/jobs/{job_id}/cancel
    Cooperative cancellation: marks the job as cancel_requested; the worker
    loop will terminate ASAP, returning partial results if possible.
    """
    st = job_manager.get(job_id)
    if not st:
        return Response({"detail": "job not found"}, status=status.HTTP_404_NOT_FOUND)
    job_manager.cancel(job_id)
    return Response({"ok": True, "job_id": job_id, "cancel_requested": True}, status=status.HTTP_202_ACCEPTED)


class UserListAdminView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def list(self, request, *args, **kwargs):
        qs = User.objects.all().order_by("id")
        return Response(self.get_serializer(qs, many=True).data)


class UserDetailAdminView(generics.RetrieveUpdateDestroyAPIView):
    """
    /api/users/<pk>/
    - GET    : مشاهدة بيانات مستخدم (للمدراء فقط)
    - PATCH  : تعديل جزئي (للمدراء فقط) — محمي من تعطيل admin
    - DELETE : حذف مستخدم (للمدراء فقط) — محمي من حذف admin أو حذف نفسك
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def patch(self, request, *args, **kwargs):
        user_obj = self.get_object()
        if user_obj.username == "admin" and "is_active" in request.data:
            return Response({"detail": "لا يمكن تعطيل حساب admin الأساسي."},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().patch(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        user_obj = self.get_object()
        # منع حذف حساب المشرف أو حذف نفسك
        if user_obj.is_superuser or user_obj.username == "admin":
            return Response({"detail": "لا يمكن حذف حساب المشرف."},
                            status=status.HTTP_400_BAD_REQUEST)
        if user_obj.id == request.user.id:
            return Response({"detail": "لا يمكنك حذف حسابك الحالي."},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().delete(request, *args, **kwargs)


# ============================================================
# Profile
# ============================================================
class MeProfileAPIView(RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProfileSerializer
    # توحيد الـ parsers (حل 415 عند JSON)
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request          # حتى يشتغل avatar_url
        return ctx


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
        # إغلاق ثغرة إنشاء Section تحت Menu لا تملكه
        menu = serializer.validated_data.get("menu")
        if not (is_admin(self.request.user) or (menu and menu.user_id == self.request.user.id)):
            raise PermissionDenied("You cannot create a section under another user's menu.")
        # المالك يُشتق من menu.user — لا نمرّر user هنا
        serializer.save()


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
        # إغلاق ثغرة إنشاء Dish تحت Section لا تملكه
        section = serializer.validated_data.get("section")
        if not (is_admin(self.request.user) or (section and section.menu.user_id == self.request.user.id)):
            raise PermissionDenied("You cannot create a dish under another user's section.")
        serializer.save()


class DishDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DishSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        base = (
            Dish.objects
            .select_related("section__menu__user__profile")
            .prefetch_related("prices", "allergen_rows__allergen")
        )
        return base if is_admin(user) else base.filter(section__menu__user=user)

    def update(self, request, *args, **kwargs):
        """
        دعم PUT/PATCH مع فحص ملكية عند محاولة تبديل الـ section.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # لو وصل section جديد ضمن الطلب، افحص الملكية
        if "section" in request.data and request.data.get("section") is not None:
            from core.models import Section as _Section
            section_id = request.data.get("section")
            try:
                new_section = _Section.objects.select_related("menu").only("menu__user_id").get(pk=section_id)
            except _Section.DoesNotExist:
                raise ValidationError({"section": "Invalid section id."})

            if not (is_admin(request.user) or new_section.menu.user_id == request.user.id):
                raise PermissionDenied("You cannot move this dish to another user's section.")

        return super().update(request, partial=partial, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


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
# Aggregated Menu (owner/admin): /api/menu?branch=<id>&lang=ar
# Returns: { "sections": [ { id, name, dishes: [...] } ] }
# ============================================================
class MenuAggregateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Accept aliases to be flexible with callers
        menu_id = (
            request.query_params.get("branch")
            or request.query_params.get("menu")
            or request.query_params.get("menu_id")
        )
        if not menu_id:
            raise ValidationError({"branch": "menu/branch id is required"})

        menu = get_object_or_404(Menu, pk=menu_id)
        user = request.user
        if not (is_admin(user) or menu.user_id == user.id):
            raise PermissionDenied("You do not have permission to access this menu")

        # ORM optimization: minimal columns + relateds for image fallback + prices
        dishes_qs = (
            Dish.objects
            .filter(section__menu=menu)
            .only("id", "name", "description", "price", "image", "allergy_info", "section_id", "generated_codes", "has_manual_codes", "manual_codes")
            .select_related("section__menu__user__profile")
            .prefetch_related(
                "prices",
                "allergen_rows__allergen",
            )
            .order_by("id")
        )
        sections_qs = (
            Section.objects
            .filter(menu=menu)
            .only("id", "name", "menu_id")
            .prefetch_related(Prefetch("dishes", queryset=dishes_qs))
            .order_by("id")
        )

        from .serializers import MenuAggregateSectionSerializer  # local import to avoid cycles
        data = MenuAggregateSectionSerializer(
            sections_qs, many=True, context={"request": request}
        ).data
        return Response({"sections": data})


# ============================================================
# Menu Display Settings
# ============================================================

class MenuDisplaySettingsDetail(APIView):
    permission_classes = [IsAuthenticated]
    # أضفنا JSONParser بجانب MultiPart/Form
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
    # توحيد وتعزيز دعم JSON
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
    # Always include the caller's private lexicon along with owner's/global

    # نطاق الأطباق
    base = Dish.objects.select_related("section__menu__user")
    qs = base if is_admin(user) else base.filter(section__menu__user=user)

    dish_ids = request.data.get("dish_ids")
    if isinstance(dish_ids, list) and dish_ids:
        qs = qs.filter(id__in=dish_ids)

    dishes = list(qs)

    # تحديد القاموس المستخدم
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
        extra_owner_ids=[user.id],
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

                # ربط بمكوّن معروف إن وُجد
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
        # allow null => global lexicon for admins
        if str(eff_owner_id).lower() in {"", "none", "null"}:
            eff_owner_id = None
        elif eff_owner_id is not None:
            try:
                eff_owner_id = int(eff_owner_id)
            except Exception:
                return Response({"detail": "owner_id must be an integer or null."}, status=status.HTTP_400_BAD_REQUEST)
    else:
        eff_owner_id = request.user.id

    owner_user = None if eff_owner_id is None else get_object_or_404(User, pk=eff_owner_id)
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

            # إذا أُرسلت أكواد؛ حدّث مكوّن/lexeme بالأكواد (مجموعات M2M على Allergen)
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
# (اختياري) حفظ سريع من LLM لقاموس محدد + Ingredient / Synonyms
# POST /api/dictionary/llm-add-terms/
# ============================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def llm_add_terms_to_lexicon(request):
    """
    تضيف المصطلحات التي اختارها المستخدم من شاشة LLM إلى:
      - KeywordLexeme (قاموس نصّي خاص بالمالك أو عام)
      - Ingredient (مكوّن مهيكل خاص بالمالك) + ربط الحساسيّات والمرادفات

    Body مثال:
    {
      "lang": "de",
      "owner_id": 11,   # صاحب المنيو (قاموس خاص) أو null للقاموس العام
      "items": [
        { "term": "kaese", "allergen_codes": "G" },
        { "term": "mascarpone", "allergen_codes": "G,K" }
      ]
    }
    """
    data = request.data or {}
    lang = (data.get("lang") or "de").strip().lower() or "de"

    owner_id = data.get("owner_id")
    # نسمح بـ null/None = قاموس عام (لكن Ingredient يحتاج owner دائماً)
    if owner_id in ("", "null", "None"):
        owner_id = None

    items = data.get("items") or []
    if not isinstance(items, list) or not items:
        return Response(
            {"detail": "items must be a non-empty list."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    created = 0
    updated = 0
    out_items = []

    for it in items:
        term = (it.get("term") or "").strip()
        if not term:
            continue

        # 1) الأكواد → كائنات Allergen
        codes_in = it.get("allergen_codes") or it.get("codes") or ""
        codes_str = _extract_codes_str(codes_in)

        allergen_objs = []
        if codes_str:
            code_list = [c for c in re.split(r"[,\s]+", codes_str) if c]
            if code_list:
                allergen_objs = list(Allergen.objects.filter(code__in=code_list))

        normalized = normalize_text(term)

        # 2) إنشاء / تحديث KeywordLexeme
        lexeme, is_created = KeywordLexeme.objects.get_or_create(
            owner_id=owner_id,
            lang=lang,
            term=term,
            defaults={
                "normalized_term": normalized,
                "is_regex": False,
                "is_active": True,
            },
        )

        if not is_created:
            lexeme.normalized_term = normalized
            lexeme.is_active = True
            lexeme.lang = lang
            lexeme.owner_id = owner_id

        lexeme.save()

        if allergen_objs:
            lexeme.allergens.set(allergen_objs)

        # 3) إنشاء / تحديث Ingredient خاص بالمالك (إن كان owner_id معروف)
        ingredient = None
        if owner_id is not None:
            ingredient, _ = Ingredient.objects.get_or_create(
                owner_id=owner_id,
                name=term,
                defaults={
                    "additives": [],
                    "synonyms": [term],
                },
            )

            # ربط الحساسيّات بنفس الأكواد
            if allergen_objs:
                ingredient.allergens.set(allergen_objs)

            # تأكد أن الـ term موجود في synonyms
            syns = list(ingredient.synonyms or [])
            if term not in syns:
                syns.append(term)
                ingredient.synonyms = syns
                ingredient.save(update_fields=["synonyms"])

            # ربط الـ lexeme بهذا الـ ingredient (لو ما كان مربوط أصلاً)
            if not lexeme.ingredient_id:
                lexeme.ingredient = ingredient
                lexeme.save(update_fields=["ingredient"])

        if is_created:
            created += 1
        else:
            updated += 1

        out_items.append(
            {
                "id": lexeme.id,
                "term": lexeme.term,
                "codes": [a.code for a in allergen_objs],
                "ingredient_id": ingredient.id if ingredient else None,
                "created": is_created,
            }
        )

    return Response(
        {
            "created": created,
            "updated": updated,
            "items": out_items,
        },
        status=status.HTTP_200_OK,
    )


# ============================================================
# DishAllergen CRUD (nested-friendly + bulk actions)
#  /api/v2/dishes/<dish_pk>/allergens/...
#  أو: /api/dish-allergens/?dish=<id>
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


# ============================================================
# Register (نسخة واحدة فقط — تثبيت الدور إلى owner)
# ============================================================

class RegisterView(generics.CreateAPIView):
    """
    إنشاء مستخدم جديد. نُثبت الدور دائماً إلى 'owner' بغض النظر عن المدخل.
    """
    serializer_class = RegisterSerializer
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    throttle_scope = "register"
    throttle_classes = [ScopedRateThrottle]  # ← NEW
    throttle_scope = "register"              # ← NEW

    def perform_create(self, serializer):
        # نغلق أي محاولة لتمرير role من الواجهة ونثبته لمالك مطعم
        serializer.save(role="owner")


# ============================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def username_available(request):
    u = (request.GET.get("username") or "").strip()
    UserModel = get_user_model()
    return Response({"available": bool(u and not UserModel.objects.filter(username__iexact=u).exists())})
username_available.throttle_scope = "availability"
username_available = throttle_classes([ScopedRateThrottle])(username_available)


@api_view(["GET"])
@permission_classes([AllowAny])
def email_available(request):
    e = (request.GET.get("email") or "").strip()
    UserModel = get_user_model()
    return Response({"available": bool(e and not UserModel.objects.filter(email__iexact=e).exists())})
email_available.throttle_scope = "availability"
email_available = throttle_classes([ScopedRateThrottle])(email_available)


# ============================================================
# Healthz (readiness) – lightweight DB connectivity check
# ============================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def healthz_api(request):
    from django.db import connection
    ok_db = True
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            _ = cur.fetchone()
    except Exception:
        ok_db = False
    status_code = status.HTTP_200_OK if ok_db else status.HTTP_503_SERVICE_UNAVAILABLE
    return Response({"ok": ok_db}, status=status_code)


# ============================================================
# KeywordLexeme List API (بديل/تصحيح لـ LexemeListAPIView)
# ============================================================

class LexemeListAPIView(ListAPIView):
    """
    تُرجع قائمة من KeywordLexeme مع فلاتر اختيارية:
      - q    : بحث جزئي في term
      - lang : اللغة
      - active: '1' أو '0'
    لغير الأدمن: تُعرض ألفاظ القاموس الخاص بالمستخدم + القاموس العام فقط.
    """
    serializer_class = KeywordLexemeSerializer
    queryset = KeywordLexeme.objects.all().order_by("id")  # ترتيب ثابت وافتراضيًا يرجع الكل

    def get_queryset(self):
        qs = super().get_queryset()

        # منع تسريب القواميس بين المُلّاك
        if not is_admin(self.request.user):
            qs = qs.filter(Q(owner=self.request.user) | Q(owner__isnull=True))

        q = self.request.GET.get("q")
        lang = self.request.GET.get("lang")
        active = self.request.GET.get("active")

        if q:
            qs = qs.filter(term__icontains=q)
        if lang:
            qs = qs.filter(lang=lang)
        if active in ("0", "1"):
            qs = qs.filter(is_active=(active == "1"))

        return qs


# ========================= END =========================
MeProfileView = MeProfileAPIView


# ============================================================
# Healthcheck endpoint (no auth) – JSONResponse variant
# ============================================================
import os  # noqa: E402,F401
from django.conf import settings  # noqa: E402,F401
from django.http import JsonResponse  # noqa: E402
from django.views.decorators.http import require_GET  # noqa: E402
from django.db import connection  # noqa: E402


@require_GET
def healthz(request):
    """
    GET /api/healthz
    يفحص اتصال قاعدة البيانات ويعيد حالة الخدمة.
    """
    db_ok = True
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception:
        db_ok = False
    return JsonResponse({
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
    })


# ------------------------------------------------------------
# Apply throttle scopes for LLM-related endpoints
# ------------------------------------------------------------
try:
    batch_generate_allergen_codes.throttle_scope = "llm"
    batch_generate_allergen_codes = throttle_classes([ScopedRateThrottle])(batch_generate_allergen_codes)

    llm_add_terms_to_lexicon.throttle_scope = "llm"
    llm_add_terms_to_lexicon = throttle_classes([ScopedRateThrottle])(llm_add_terms_to_lexicon)

    llm_direct_codes.throttle_scope = "llm"
    llm_direct_codes = throttle_classes([ScopedRateThrottle])(llm_direct_codes)

    # Lightweight GET helpers use availability throttle
    llm_eta.throttle_scope = "availability"
    llm_eta = throttle_classes([ScopedRateThrottle])(llm_eta)

    llm_limits.throttle_scope = "availability"
    llm_limits = throttle_classes([ScopedRateThrottle])(llm_limits)

    llm_jobs_start_batch_generate.throttle_scope = "llm"
    llm_jobs_start_batch_generate = throttle_classes([ScopedRateThrottle])(llm_jobs_start_batch_generate)

    llm_jobs_status.throttle_scope = "availability"
    llm_jobs_status = throttle_classes([ScopedRateThrottle])(llm_jobs_status)
    llm_jobs_cancel.throttle_scope = "llm"
    llm_jobs_cancel = throttle_classes([ScopedRateThrottle])(llm_jobs_cancel)
except Exception:
    # If import order or name lookup fails in some contexts, ignore.
    pass

