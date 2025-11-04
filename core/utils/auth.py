# core/utils/auth.py
from typing import Any

def is_admin(user: Any) -> bool:
    """
    معيار موحّد للأدمن:
    - مستخدم موثّق
    - role == 'admin' أو is_staff == True
    """
    try:
        return bool(
            user
            and getattr(user, "is_authenticated", False)
            and (
                getattr(user, "is_staff", False)
                or getattr(user, "role", None) == "admin"
            )
        )
    except Exception:
        return False
