import os, sys
from datetime import datetime, timezone
from django.core.management.base import BaseCommand

from openai import OpenAI
from openai import APIStatusError  # لو مكتبتك أقدم، استخدم OpenAIError

def _fmt(v): return str(v) if v not in (None, "") else "-"

def _print_headers(h):
    keys = [
        "x-request-id",
        "x-ratelimit-remaining-requests",
        "x-ratelimit-limit-requests",
        "x-ratelimit-reset-requests",
        "x-ratelimit-remaining-tokens",
        "x-ratelimit-limit-tokens",
        "x-ratelimit-reset-tokens",
        "retry-after",
    ]
    print("\n[RateLimit]")
    for k in keys:
        print(f"  {k:32} {_fmt(h.get(k))}")

class Command(BaseCommand):
    help = "Ping OpenAI and print rate-limit/quota headers."

    def add_arguments(self, parser):
        parser.add_argument("--model", default="gpt-4.1-mini")
        parser.add_argument("--timeout", type=int, default=20)
        parser.add_argument("--prompt", default="Return the single word: PONG")

    def handle(self, *args, **opts):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            self.stderr.write(self.style.ERROR("OPENAI_API_KEY is not set"))
            sys.exit(2)

        model   = opts["model"]
        timeout = int(opts["timeout"])
        prompt  = opts["prompt"]

        client = OpenAI(api_key=api_key)

        print(f"[{datetime.now(timezone.utc).isoformat()}] Checking LLM…")
        print(f"  model: {model}")
        print(f"  timeout: {timeout}s")

        try:
            # <<< المهم: with_raw_response لضمان قراءة الهيدرز >>>
            raw = client.chat.completions.with_raw_response.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=5,
                temperature=0,
                timeout=timeout,
            )
            headers = dict(raw.headers or {})
            data = raw.parse()  # يحوّلها لكائن Python

            print("\n[Status] OK 200")
            try:
                out = (data.choices[0].message.content or "").strip()
            except Exception:
                out = ""
            print(f"[Output] {out!r}")

            # اطبع الاستهلاك لو متاح
            usage = getattr(data, "usage", None)
            if usage:
                print("[Usage] prompt=%s, completion=%s, total=%s" %
                      (_fmt(usage.prompt_tokens), _fmt(usage.completion_tokens), _fmt(usage.total_tokens)))

            _print_headers(headers)
            print("\nDone.")
            return

        except APIStatusError as e:
            status  = getattr(e, "status_code", None) or getattr(e, "http_status", None) or "ERR"
            headers = {}
            try:
                headers = dict(getattr(e.response, "headers", {}) or {})
            except Exception:
                pass

            err_type = None
            msg = str(e)
            try:
                body = e.response.json()
                err = body.get("error") or {}
                err_type = err.get("type")
                msg = err.get("message", msg)
            except Exception:
                pass

            print(f"\n[Status] ERROR {status}")
            if err_type:
                print(f"[Error Type] {err_type}")
            print(f"[Message] {msg}")
            _print_headers(headers)

            if str(status) == "429":
                print("\nHint: Rate-limited. راقب retry-after و x-ratelimit-reset-*.")
            if err_type == "insufficient_quota":
                print("\nHint: INSUFFICIENT QUOTA — راجع الرصيد/الاشتراك.")
            sys.exit(1)

        except Exception as e:
            print(f"\n[Status] EXCEPTION: {type(e).__name__}: {e}")
            sys.exit(3)
