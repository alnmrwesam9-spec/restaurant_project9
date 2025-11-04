# core/llm_clients/openai_client.py
import os
import re
from typing import Optional
from openai import OpenAI, RateLimitError, APIError, APIConnectionError, AuthenticationError

MODEL_ALIAS = {
    "gpt-4.1": "gpt-4o",
    "gpt-4.1-mini": "gpt-4o-mini",
    "gpt-4.1-nano": "gpt-4o-mini",
}

class LLMError(Exception):
    """خطأ عام في استدعاء LLM."""
    pass

class LLMRateLimit(LLMError):
    """تخطي السقف (429)."""
    pass

def _resolve_model(name: str) -> str:
    if not name:
        return "gpt-4o-mini"
    return MODEL_ALIAS.get(name, name)

def openai_caller(
    prompt: str,
    *,
    model_name: str,
    temperature: float = 0.2,
    max_tokens: int = 512,
    timeout: int = 60,
) -> str:
    """
    نداء بسيط لـ OpenAI Chat Completions مع معالجة أخطاء مفيدة.
    - يأخذ الـAPI Key من OPENAI_API_KEY (متغير البيئة).
    - يعمل alias للأسماء الحديثة.
    - يرمي LLMRateLimit عند 429 حتى تتعامل الواجهة معه برِفق.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise LLMError("OPENAI_API_KEY is not set in environment.")

    client = OpenAI(api_key=api_key, timeout=timeout)
    model = _resolve_model(model_name)

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=float(temperature),
            max_tokens=int(max_tokens),
        )
        return (resp.choices[0].message.content or "").strip()

    except RateLimitError as e:
        # نستخرج تلميح "try again in XmYs" إن وجد
        msg = str(e)
        wait_hint = ""
        m = re.search(r"in\s+(\d+)m(\d+)s", msg)
        if m:
            wait_hint = f" (try again in ~{m.group(1)}m {m.group(2)}s)"
        raise LLMRateLimit(f"Rate limit for {model}{wait_hint}") from e

    except AuthenticationError as e:
        raise LLMError("Invalid OPENAI_API_KEY or auth error.") from e

    except APIConnectionError as e:
        raise LLMError(f"Network error contacting OpenAI: {e}") from e

    except APIError as e:
        raise LLMError(f"OpenAI API error: {e}") from e

    except Exception as e:
        raise LLMError(f"Unexpected LLM error: {e}") from e
