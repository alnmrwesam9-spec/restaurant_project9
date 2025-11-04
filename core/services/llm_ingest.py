# core/services/llm_ingest.py
# ============================================================
# LLM pipeline: Extract German food terms (Zutaten) and map them
# to allergen letter codes (A..Z). Designed to work with
# core/llm_clients/openai_client.openai_caller
# ============================================================

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, Iterable, List, Tuple
import json
import re

# نوع الدالة التي تستدعي نموذج OpenAI (نمررها من الخارج)
LLMCaller = Callable[..., str]


# ------------------------------------------------------------
# Config
# ------------------------------------------------------------
@dataclass
class LLMConfig:
    model_name: str = "gpt-4o-mini"
    lang: str = "de"
    max_terms: int = 12            # ← افتراضي أقوى
    temperature: float = 0.2       # ← ثابت ومحافظ
    dry_run: bool = True
    max_output_tokens: int = 512
    timeout: int = 60


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
# كلمة ألمانية (مع الأحرف الممدودة) + السماح بالمركبات واستخدام -
_WORD_RE = re.compile(r"[A-Za-zÄÖÜäöüẞß\u00C0-\u017F][A-Za-zÄÖÜäöüẞß\u00C0-\u017F\-]+", re.UNICODE)

def normalize_de(s: str) -> str:
    """تبسيط/تطبيع بسيط للألمانية: أحرف صغيرة + تحويل ß→ss و ä→ae/ö→oe/ü→ue + مسافات موحّدة."""
    if not s:
        return ""
    x = s.strip().lower()
    x = re.sub(r"\s+", " ", x)
    # تحويل بعض البدائل الشائعة
    repl = {
        "ß": "ss",
        "ä": "ae",
        "ö": "oe",
        "ü": "ue",
    }
    for a, b in repl.items():
        x = x.replace(a, b)
    # توحيد بعض العلامات
    x = x.replace("œ", "oe").replace("æ", "ae")
    return x

def _dedup_keep_order(items: Iterable[str]) -> List[str]:
    seen, out = set(), []
    for it in items:
        if not it:
            continue
        if it not in seen:
            seen.add(it)
            out.append(it)
    return out

def _clean_codes_str(codes: str) -> str:
    """حروف A..Z مفصولة بفواصل (بدون مسافات/تكرار)."""
    bag = []
    for tok in re.split(r"[,\s]+", str(codes or "").upper()):
        tok = tok.strip()
        if len(tok) == 1 and "A" <= tok <= "Z":
            bag.append(tok)
    return ",".join(_dedup_keep_order(bag))

def _parse_json_object_or_array(txt: str):
    """حاول استخراج JSON (object/array) من رد النموذج حتى لو لفّه داخل ```json ...```."""
    if not txt:
        return None
    # التقط كتل ```json ... ```
    m = re.search(r"```json\s*(.+?)\s*```", txt, flags=re.S | re.I)
    if m:
        txt = m.group(1).strip()
    # التقط أول {} أو []
    mobj = re.search(r"\{.*\}", txt, flags=re.S)
    marr = re.search(r"\[.*\]", txt, flags=re.S)
    fragment = mobj.group(0) if mobj else (marr.group(0) if marr else txt)
    try:
        return json.loads(fragment)
    except Exception:
        return None


# ------------------------------------------------------------
# LLM: Extract candidate terms
# ------------------------------------------------------------
def llm_extract_terms(
    caller: LLMCaller,
    cfg: LLMConfig,
    dish_name: str,
    dish_description: str,
    *,
    return_raw: bool = False,
) -> Tuple[List[str], str] | List[str]:
    """
    يرجّع قائمة مصطلحات Zutaten (ألمانية) بطول لا يتجاوز cfg.max_terms.
    إن فشل LLM نستخدم fallback محلي بسيط باستخراج كلمات وأسماء شائعة.
    """
    name = dish_name or ""
    desc = dish_description or ""
    lang = (cfg.lang or "de").lower()

    # برومبت موجّه مع أمثلة قصيرة (few-shot) لزيادة الدقة.
    prompt = f"""
You are a precise German culinary term extractor.
Task: Given a dish name/description, return ONLY JSON array of distinct German ingredient-like terms (nouns/compounds). No translations, no explanations.

Rules:
- Output <= {cfg.max_terms} items, lowercased, concise single tokens if possible (compound allowed, e.g., "joghurtsose", "sesampaste", "doenerfleisch", "brioche-bun").
- Skip generic fillers that aren't ingredients (e.g., "gericht", "hausgemacht", "frisch", "lecker", "portion", "klassisch").
- If ingredient is ambiguous ("sose", "salat"), keep it but prefer more specific forms if present ("joghurtsose", "mayonnaise", "senf", "kaese").
- Return ONLY a JSON array (no code blocks).

Examples:
INPUT: "Döner Teller — Dönerfleisch, Soße, Salat, Kraut, Zwiebeln, Tomaten"
OUTPUT: ["doenerfleisch","sose","salat","kraut","zwiebeln","tomaten"]

INPUT: "Chicken Wrap mit Joghurtsoße und Sesam"
OUTPUT: ["chicken","joghurtsose","sesam","wrap"]

INPUT: "Falafel mit Tahini (Sesampaste), Salat, Tomaten"
OUTPUT: ["falafel","tahini","sesampaste","salat","tomaten"]

Now extract for language={lang}:

NAME: {name}
DESC: {desc}

Return ONLY JSON array:
""".strip()

    raw = ""
    terms: List[str] = []
    try:
        raw = caller(
            prompt,
            model_name=cfg.model_name,
            temperature=cfg.temperature,
            max_tokens=min(cfg.max_output_tokens, 256),
            timeout=cfg.timeout,
        )
        data = _parse_json_object_or_array(raw)
        if isinstance(data, list):
            terms = [normalize_de(str(x)) for x in data if isinstance(x, (str, int, float))]
    except Exception:
        terms = []

    # Fallback محلي إذا فشل LLM أو النتيجة فارغة
    if not terms:
        text = normalize_de(f"{name} {desc}")
        cand = _WORD_RE.findall(text)
        # ترشيح كلمات شائعة لا تفيد
        stop = {
            "mit","und","oder","vom","hausgemacht","lecker","frisch","gericht",
            "portion","gross","klein","grossen","kleinen","serviert","klassisch","spezial",
            "menu","menue","gerichtname","gerichtnamen","gerichtname","teller","beilage",
        }
        cand = [c for c in cand if c not in stop and len(c) >= 3]
        # خذ أول max_terms
        terms = cand[: cfg.max_terms]

    # تمييز موحد
    terms = _dedup_keep_order([t for t in terms if t])

    if return_raw:
        return terms, raw or ""
    return terms


# ------------------------------------------------------------
# Mapping rules (heuristics) before/with LLM
# ------------------------------------------------------------
# ملاحظة: مخطط الحروف أدناه متوافق مع بذورك (A=Gluten, B=Krebstiere, C=Eier, D=Fisch,
# E=Erdnüsse, F=Soja, G=Milch/Laktose, H=Nüsse, J=Senf, K=Sesam, L=Sellerie, N=Lupine, ...)
# عدّل عند اللزوم ليتطابق مع جدول Allergen الفعلي لديك.

# قوائم مرادفات شائعة لكل كود
HEURISTIC_LEXICON: Dict[str, List[str]] = {}

def _seed_heuristics():
    def add(words: Iterable[str], *codes: str):
        for w in words:
            HEURISTIC_LEXICON[normalize_de(w)] = list(codes)

    # A = Glutenhaltiges Getreide
    add([
        "weizen","weizenmehl","mehl","brot","broetchen","brötchen","semmel","semmelbroesel","semmelbrösel",
        "griess","grieß","panade","panier","paniermehl","teig","pasta","nudeln","spaghetti",
        "couscous","bulgur","dinkel","gerste","roggen","graupen","knoedel","knödel","pizza","fladenbrot",
        "pizzateig","biskuit","biscuit","blaetterteig","blätterteig","muerbeteig","mürbeteig","strudel","waffel",
        "pfannkuchen","palatschinken","brioche","pane","buns","brioche-bun","gnocchi","tarte","crepe","crêpe",
        "gries","grieß","semola",
    ], "A")

    # C = Eier
    add(["ei","eier","eipulver","mayonnaise","mayo","remoulade","aioli","omelett","baiser","meringue","creme brulee","crème brûlée"], "C")

    # G = Milch/Laktose
    add([
        "milch","laktose","kaese","käse","cheddar","mozzarella","gouda","parmesan","pecorino",
        "joghurt","joghurtsose","yoghurt","butter","sahne","rahm","quark","labneh","labna",
        "creme fraiche","crème fraîche","mascarpone","buttercreme","pudding","ricotta","obers","sahnecreme","mousse",
        "vollmilchschokolade","schokolade","kuvertüre","kuvertuere","yoghurtsose",
        "sojamilch",  # قد تحمل G أحيانًا (منتجات جاهزة)
    ], "G")

    # J = Senf
    add(["senf","senfkoerner","senfkorn","senfsosse","senfsauce","senfpulver","dijon"], "J")

    # K = Sesam
    add(["sesam","sesampaste","tahini","tahin"], "K")

    # F = Soja
    add(["soja","sojasauce","shoyu","tofu","edamame","miso","tempeh","sojamilch"], "F")

    # H = Schalenfrüchte (Nüsse)
    add(["walnuss","walnuesse","haselnuss","mandel","pistazie","cashew","paranuss","pekannuss","macadamia","pinienkerne","nougat","nutella","haselnusscreme"], "H")

    # E = Erdnüsse
    add(["erdnuss","erdnuesse","peanut","peanuts","erdnussbutter"], "E")

    # D = Fisch
    add(["fisch","lachs","thunfisch","forelle","haring","sardine","kabeljau","barsch","seezunge","fischfilet"], "D")

    # B = Krebstiere
    add(["garnelen","shrimps","krebs","krabben","languste","hummer","scampi"], "B")

    # L = Sellerie
    add(["sellerie","selleriesalz","selleriewurzel","selleriestange"], "L")

    # N = Lupine
    add(["lupine","lupinenmehl"], "N")

    # مركبّات شائعة
    add(["pesto"], "H", "G")   # صنوبر + جبن غالباً

_seed_heuristics()


# أنماط مركبة: إذا انطبق أيٌّ منها، نقترح الكود بثقة أعلى
# pattern, code, confidence, reason
COMPOSITE_PATTERNS: List[Tuple[re.Pattern, str, float, str]] = [
    # صلصات تحتوي مشتقات اللبن
    (re.compile(r"\b(joghurt|yoghurt).*(sose|sauce)\b"), "G", 0.9, "joghurt sauce"),
    # صلصات المايونيز/الايولي → بيض
    (re.compile(r"\b(aioli|mayonnaise|mayo|remoulade)\b"), "C", 0.9, "egg-based sauce"),
    # خبز/عجين/بانير → جلوتين
    (re.compile(r"\b(brot|fladenbrot|teig|panier|panade|semmelbroesel|semmelbrösel|mehl|pizzateig|biskuit|blaetterteig|blätterteig|muerbeteig|mürbeteig|waffel|pfannkuchen|palatschinken)\b"), "A", 0.85, "gluten cereal"),
    # جبنة/ألبان
    (re.compile(r"\b(kaese|käse|cheddar|mozzarella|gouda|parmesan|pecorino|sahne|rahm|butter|joghurt|quark|mascarpone|ricotta|obers|pudding|buttercreme|creme\s*fraiche|crème\s*fraîche)\b"), "G", 0.88, "dairy"),
    # شوكولاتة (عادة تحتوي حليب)
    (re.compile(r"\b(schokolade|vollmilchschokolade|kuvert(ue|ü)re)\b"), "G", 0.8, "chocolate dairy"),
    # سمسم/طحينة
    (re.compile(r"\b(sesam|tahini|sesampaste|tahin)\b"), "K", 0.9, "sesame"),
    # صويا
    (re.compile(r"\b(soja|sojasauce|tofu|miso|tempeh|shoyu|edamame|sojamilch)\b"), "F", 0.85, "soy"),
    # بيض
    (re.compile(r"\b(ei|eier|omelett|baiser|meringue|creme\s*brulee|crème\s*brûlée)\b"), "C", 0.85, "egg"),
    # خردل
    (re.compile(r"\b(senf|senfs(ose|auce)|dijon)\b"), "J", 0.85, "mustard"),
    # مكسرات
    (re.compile(r"\b(walnuss|haselnuss|mandel|pistazie|cashew|paranuss|pekannuss|macadamia|pinienkerne|nougat|nutella|haselnusscreme)\b"), "H", 0.85, "tree nuts"),
    # سمك
    (re.compile(r"\b(lachs|thunfisch|forelle|sardine|kabeljau|fisch)\b"), "D", 0.85, "fish"),
    # قشريات
    (re.compile(r"\b(garnelen|shrimps|krabben|hummer|scampi|languste)\b"), "B", 0.9, "crustaceans"),
    # بيستو (غالبًا: صنوبر + جبن)
    (re.compile(r"\b(pesto)\b"), "H", 0.8, "pesto (nuts)")  # سنضيف G أيضًا عبر HEURISTIC_LEXICON
]

def _heuristic_map(term: str) -> Tuple[str, float, str]:
    """
    محاولة حاسمة سريعة:
    - قاموس كلمات مباشر (قد يرجّع أكثر من كود، ندمجها).
    - أنماط مركّبة.
    """
    t = normalize_de(term)

    # قاموس مباشر
    codes_list = HEURISTIC_LEXICON.get(t)
    if codes_list:
        reason = "heuristic"
        # ثقة محافظة تعتمد على طبيعة الكود
        high = {"B","C","D","E","F","G","H","J","K","L","N"}
        conf = 0.7 if any(c in high for c in codes_list) else 0.6
        return ",".join(codes_list), conf, reason

    # أنماط مركّبة (داخل المصطلح نفسه)
    for rx, code, conf, why in COMPOSITE_PATTERNS:
        if rx.search(t):
            return code, conf, why

    return "", 0.0, ""


# ------------------------------------------------------------
# LLM: map terms → codes (with heuristics + few-shot)
# ------------------------------------------------------------
def llm_map_terms_to_codes(
    caller: LLMCaller,
    cfg: LLMConfig,
    terms: Iterable[str],
    *,
    lang: str = "de",
) -> Dict[str, Dict[str, object]]:
    """
    يرجّع قاموسًا: term(lower) → {codes: 'A,G', confidence: float, reason: str}
    - يبدأ بهيورستك قوية (قاموس/أنماط).
    - يكمل بما تبقى عبر LLM مع few-shot.
    """
    out: Dict[str, Dict[str, object]] = {}
    terms_list = _dedup_keep_order([normalize_de(t) for t in terms if t])

    # 1) هيورستك أولية
    remaining: List[str] = []
    for t in terms_list:
        codes, conf, why = _heuristic_map(t)
        if codes:
            out[t] = {"codes": _clean_codes_str(codes), "confidence": round(float(conf), 3), "reason": why}
        else:
            remaining.append(t)

    if not remaining:
        return out

    # 2) LLM mapping (few-shot)
    # نزوّده بخريطة الأكواد + أمثلة لقرارات مؤكدة/مرفوضة
    allergen_map_hint = """
A = glutenhaltiges Getreide (Weizen, Dinkel, Roggen, Gerste, Mehl, Teig, Brot, Panier, Nudeln, Pasta, Couscous, Bulgur)
B = Krebstiere (Garnelen, Shrimps, Krabben, Hummer, Scampi)
C = Eier (Ei, Eier, Mayonnaise, Mayo, Remoulade, Aioli, Baiser/Meringue)
D = Fisch (Fisch, Lachs, Thunfisch, Forelle, Kabeljau, Sardine)
E = Erdnüsse (Erdnuss, Erdnussbutter)
F = Soja (Soja, Sojasauce/Shoyu, Tofu, Miso, Tempeh, Edamame, Sojamilch)
G = Milch/Laktose (Milch, Käse/Kaese, Joghurt, Butter, Sahne/Rahm, Quark, Mascarpone, Ricotta, Creme Fraiche)
H = Schalenfrüchte/Nüsse (Walnuss, Haselnuss, Mandel, Pistazie, Cashew, Pekannuss, Paranuss, Macadamia, Pinienkerne, Nougat, Nutella)
J = Senf (Senf, Dijon)
K = Sesam (Sesam, Tahini, Sesampaste)
L = Sellerie (Sellerie)
N = Lupine (Lupine, Lupinenmehl)
""".strip()

    examples = """
Examples (decide codes; if uncertain, return empty codes with low confidence):
- "joghurtsose" → G (dairy sauce) conf≈0.9
- "mayonnaise" → C (egg-based) conf≈0.9
- "aioli" → C (egg-based emulsion) conf≈0.8
- "senf" → J conf≈0.9
- "tahini" → K conf≈0.9
- "sojasauce" → F conf≈0.9
- "weizenmehl" → A conf≈0.9
- "brot" → A conf≈0.75
- "pizza" → A conf≈0.7
- "cheddar" → G conf≈0.9
- "lachs" → D conf≈0.9
- "garnelen" → B conf≈0.9
- "vollmilchschokolade" → G conf≈0.8
- "nougat" → H conf≈0.8
- "salat" → (empty) conf≈0.0 (not an allergen per se)
- "dönerfleisch" → (empty) conf≈0.0 (no inherent allergen)
""".strip()

    prompt = f"""
You are an expert allergen labeler for German menus.
Map each term to EU-style allergen LETTER codes used by this system (A..Z subset), using the hint map below.
Return ONLY JSON object: keys = terms (lowercased), values = {{"codes": "A,C", "confidence": 0.0..1.0, "reason": "short"}}

Allergen hint:
{allergen_map_hint}

{examples}

Rules:
- Use letters only, comma-separated (no spaces). Example: "A,G" or "" for none.
- If a term is generic (e.g., "salat", "kraut", "zwiebeln", "tomaten", "fleisch"), return empty codes with confidence 0.0.
- Be conservative: Only assign a code if the term strongly implies that allergen.
- Confidence: 0.7–0.95 when strong; 0.3–0.6 when plausible but not guaranteed; 0 for none.
- Reason must be short ("dairy", "egg-based", "sesame", "gluten cereal", "tree nuts", ...).

Terms (language={lang}):
{json.dumps(remaining, ensure_ascii=False)}

Return ONLY JSON object:
""".strip()

    try:
        raw = caller(
            prompt,
            model_name=cfg.model_name,
            temperature=cfg.temperature,
            max_tokens=min(cfg.max_output_tokens, 512),
            timeout=cfg.timeout,
        )
        data = _parse_json_object_or_array(raw)
        if isinstance(data, dict):
            for k, v in data.items():
                term = normalize_de(k)
                if term not in remaining:
                    continue
                codes = ""
                conf = 0.0
                reason = ""
                if isinstance(v, dict):
                    codes = _clean_codes_str(v.get("codes", ""))
                    try:
                        conf = float(v.get("confidence", 0.0))
                    except Exception:
                        conf = 0.0
                    reason = str(v.get("reason", "") or "")
                out[term] = {"codes": codes, "confidence": round(conf, 3), "reason": reason or "llm"}
        else:
            # لو رجع شيء غير متوقع، لا نكسر التنفيذ
            for term in remaining:
                out.setdefault(term, {"codes": "", "confidence": 0.0, "reason": "llm_unparsed"})
    except Exception:
        # في حال فشل نعيد الباقي كـ unknown
        for term in remaining:
            out.setdefault(term, {"codes": "", "confidence": 0.0, "reason": "llm_error"})

    return out


# ------------------------------------------------------------
# (اختياري) LLM مباشر لإرجاع الأكواد من الاسم/الوصف
# ------------------------------------------------------------
def llm_map_dish_to_codes(caller: LLMCaller, cfg: LLMConfig, name: str, description: str) -> Dict[str, str]:
    """
    يطلب من LLM إرجاع الأكواد مباشرة من الاسم+الوصف.
    يعيد: {"codes": "A,C,G", "raw": "..."} — حيث codes قد تكون فارغة إن لم يجد ما يكفي من قرائن.
    """
    text = (name or "").strip()
    if description:
        text += f"\n\nBeschreibung:\n{description.strip()}"

    prompt = f"""
Du bist ein präziser Allergen-Klassifizierer für deutsche Speisekarten.
Gib ausschließlich die Allergen-BUCHSTABEN (A..R) für dieses Gericht zurück, als CSV ohne Leerzeichen.
Sei konservativ: Nur Codes, die stark impliziert sind. Keine Erklärungen, nur die eine Zeile im Format unten.

Gericht:
{text}

Antwort-Format GENAU (eine Zeile):
codes: A,C,G
Falls nichts sicher: gib "codes: "
""".strip()

    raw = caller(
        prompt,
        model_name=cfg.model_name,
        temperature=cfg.temperature,
        max_tokens=min(128, cfg.max_output_tokens),
        timeout=cfg.timeout,
    )

    # التقاط "codes: A,C,G"
    codes = ""
    m = re.search(r"codes:\s*([A-R](?:\s*,\s*[A-R])*)", raw, re.IGNORECASE)
    if m:
        codes = ",".join([p.strip().upper() for p in m.group(1).split(",") if p.strip()])
    else:
        # fallback: خط دفاعي بسيط
        tokens = re.findall(r"\b[A-R]\b", raw.upper())
        codes = ",".join(sorted(set(tokens)))

    return {"codes": codes or "", "raw": (raw or "").strip()}
