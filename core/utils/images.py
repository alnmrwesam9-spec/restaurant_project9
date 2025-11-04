# backend/core/utils/images.py
import io
import os
from uuid import uuid4
from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError, ImageFile

# كن صارمًا تجاه الصور المبتورة
ImageFile.LOAD_TRUNCATED_IMAGES = False


def validate_and_clean_image(file):
    """
    يتحقق وينظّف ملف الصورة:
    - يفرض حد الحجم بالميغابايت
    - يتحقق أن الملف صورة سليمة فعلًا (Pillow)
    - يسمح فقط بصيغ محددة (JPEG/PNG/WEBP)
    - يقيّد الأبعاد الإجمالية
    - (اختياري) يغيّر المقاس بحسب MAX_IMAGE_SIDE
    - يزيل EXIF والبيانات المضمنة بإعادة الحفظ
    - WebP ذكي: يجرّب WebP ويختار الأصغر
    - يعيد ContentFile باسم آمن وامتداد صحيح
    """

    # حجم أقصى
    max_size_bytes = int(getattr(settings, "MAX_UPLOAD_IMAGE_MB", 5)) * 1024 * 1024
    if getattr(file, "size", 0) > max_size_bytes:
        raise ValueError(f"Image exceeds max size of {getattr(settings, 'MAX_UPLOAD_IMAGE_MB', 5)}MB.")

    # إلى BytesIO
    file_bytes = file.read()
    file_stream = io.BytesIO(file_bytes)

    try:
        img = Image.open(file_stream)
        img.verify()  # تحقق سريع أنها صورة سليمة
    except UnidentifiedImageError:
        raise ValueError("Uploaded file is not a valid image.")

    # افتح ثانيةً بعد verify
    file_stream.seek(0)
    img = Image.open(file_stream)

    # الصيغة
    fmt = (img.format or "").upper()
    allowed = list(getattr(settings, "ALLOWED_IMAGE_FORMATS", ["JPEG", "PNG", "WEBP"]))
    if fmt not in allowed:
        raise ValueError(f"Unsupported image format. Allowed: {allowed}")

    # الأبعاد القصوى (حماية الذاكرة)
    width, height = img.size
    if (width or 0) * (height or 0) > int(getattr(settings, "MAX_IMAGE_PIXELS", 36_000_000)):
        raise ValueError("Image dimensions too large.")

    # === Resize (optional by MAX_IMAGE_SIDE) ===
    max_side = int(getattr(settings, "MAX_IMAGE_SIDE", 0) or 0)
    if max_side > 0 and max(width, height) > max_side:
        scale = max_side / float(max(width, height))
        new_w = int(width * scale)
        new_h = int(height * scale)
        # ضمان وضع التحويل المناسب قبل التصغير
        if img.mode not in ("RGB", "RGBA", "L", "LA"):
            img = img.convert("RGB")
        img = img.resize((new_w, new_h), Image.LANCZOS)
        width, height = img.size  # تحديث القيم

    # إزالة EXIF بإعادة الحفظ إلى تدفّق جديد + إعدادات النوع
    cleaned_io = io.BytesIO()
    save_kwargs = {}
    if fmt == "JPEG":
        if img.mode != "RGB":
            img = img.convert("RGB")
        save_kwargs = {
            "format": "JPEG",
            "quality": int(getattr(settings, "JPEG_QUALITY", 85)),
            "optimize": True,
        }
    elif fmt == "PNG":
        # Pillow سيحترم optimize لخفض الحجم
        save_kwargs = {
            "format": "PNG",
            "optimize": bool(getattr(settings, "PNG_OPTIMIZE", True)),
        }
        # حافظ على الشفافية في PNG
        if img.mode not in ("RGBA", "LA", "RGB", "L"):
            img = img.convert("RGBA")
    elif fmt == "WEBP":
        # إن كانت بالفعل WEBP — نعيد حفظها بجودة مضبوطة (lossy أو lossless حسب وجود ألفا)
        has_alpha = (img.mode in ("RGBA", "LA")) or ("transparency" in img.info)
        # تأكد من الصيغة قبل الحفظ
        if has_alpha and img.mode not in ("RGBA", "LA"):
            img = img.convert("RGBA")
        elif not has_alpha and img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        save_kwargs = {
            "format": "WEBP",
            "quality": int(getattr(settings, "WEBP_QUALITY", 82)),
            "method": int(getattr(settings, "WEBP_METHOD", 4)),
            "lossless": bool(has_alpha),  # PNG-like محتوى غالبًا أفضل lossless
        }
    else:
        # fallback — نحاول حفظها كما هي بدون EXIF
        save_kwargs = {"format": fmt}

    img.save(cleaned_io, **save_kwargs)
    cleaned_io.seek(0)
    cleaned_bytes = cleaned_io.getvalue()
    cleaned_len = len(cleaned_bytes)

    # خيار WebP: جرّب توليد WebP واختر الأصغر
    use_webp = bool(getattr(settings, "PREFER_WEBP", True))
    picked_bytes = cleaned_bytes
    picked_fmt = fmt

    if use_webp and fmt in {"JPEG", "PNG"}:
        webp_io = io.BytesIO()
        has_alpha = (img.mode in ("RGBA", "LA")) or ("transparency" in img.info)
        # تأكد من الصيغة الصحيحة قبل WebP
        if has_alpha and img.mode not in ("RGBA", "LA"):
            img = img.convert("RGBA")
        elif not has_alpha and img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        webp_kwargs = {
            "format": "WEBP",
            "quality": int(getattr(settings, "WEBP_QUALITY", 82)),
            "method": int(getattr(settings, "WEBP_METHOD", 4)),
            "lossless": bool(has_alpha),
        }
        img.save(webp_io, **webp_kwargs)
        webp_io.seek(0)
        webp_bytes = webp_io.getvalue()

        # اختر الأصغر حجمًا (تجنّب زيادة الحجم في بعض PNG الصغيرة)
        if len(webp_bytes) < cleaned_len:
            picked_bytes = webp_bytes
            picked_fmt = "WEBP"

    # اسم الملف النهائي بالامتداد الصحيح
    try:
        _ = os.path.basename(getattr(file, "name", "upload"))
    except Exception:
        _ = "upload"
    filename = f"{uuid4().hex}.{picked_fmt.lower()}"

    cleaned = ContentFile(picked_bytes, name=filename)
    # وسمه ليتمكن signals/serializers من تجنّب التنظيف المكرر
    try:
        setattr(cleaned, "_cleaned_image", True)
    except Exception:
        pass
    return cleaned
