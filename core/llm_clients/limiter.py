import os
import threading
import time
import math
import random
from typing import Callable, Optional, Tuple


class _Budget:
    def __init__(self, capacity: int):
        self.capacity = max(0, int(capacity))
        self.remaining = max(0, int(capacity))
        self.reset_at = time.monotonic() + 60.0

    def refresh_if_needed(self) -> None:
        now = time.monotonic()
        if now >= self.reset_at:
            # Align to next whole minute window to avoid drift
            # but simple +60 is fine for our purpose
            self.remaining = self.capacity
            self.reset_at = now + 60.0

    def take(self, amount: int) -> bool:
        self.refresh_if_needed()
        if amount <= self.remaining:
            self.remaining -= amount
            return True
        return False

    def time_until_reset(self) -> float:
        self.refresh_if_needed()
        return max(0.0, self.reset_at - time.monotonic())


def _env_int(name: str, default: int) -> int:
    try:
        v = int(os.getenv(name, str(default)).strip())
        return v if v >= 0 else default
    except Exception:
        return default


class RateLimiter:
    """
    Simple in-process limiter for RPM + TPM + concurrency.
    - RPM: requests per minute (integer reservoir)
    - TPM: tokens per minute (integer reservoir)
    - concurrency: max simultaneous calls

    Not a silver bullet for multi-process deployments, but effective in a single process.
    """

    def __init__(
        self,
        rpm: int = 60,
        tpm: int = 300_000,
        concurrency: int = 10,
        max_retries: int = 6,
    ) -> None:
        self._rpm_budget = _Budget(max(0, rpm))
        self._tpm_budget = _Budget(max(0, tpm))
        self._sem = threading.Semaphore(max(1, concurrency))
        self._lock = threading.Lock()
        self._max_retries = max(1, int(max_retries))

        # stats for throughput estimation
        self._started_at = time.monotonic()
        self._completed = 0

    # ---------- public config/stat helpers ----------
    def config(self) -> dict:
        return {
            "rpm": self._rpm_budget.capacity,
            "tpm": self._tpm_budget.capacity,
            "concurrency": self._sem._value + self._sem._waiters if hasattr(self._sem, "_value") else None,  # best-effort
            "max_retries": self._max_retries,
        }

    def budgets(self) -> dict:
        # best-effort snapshot
        with self._lock:
            self._rpm_budget.refresh_if_needed()
            self._tpm_budget.refresh_if_needed()
            return {
                "rpm_remaining": self._rpm_budget.remaining,
                "rpm_resets_in_sec": round(self._rpm_budget.time_until_reset(), 3),
                "tpm_remaining": self._tpm_budget.remaining,
                "tpm_resets_in_sec": round(self._tpm_budget.time_until_reset(), 3),
                "completed": self._completed,
                "uptime_sec": round(time.monotonic() - self._started_at, 3),
            }

    def stats(self) -> dict:
        with self._lock:
            elapsed_min = max(1e-6, (time.monotonic() - self._started_at) / 60.0)
            rate = self._completed / elapsed_min
            b = self.budgets()
        return {"throughput_per_min": rate, **b}

    # ---------- core execution ----------
    def _await_budgets(self, token_cost: int) -> None:
        token_cost = max(0, int(token_cost))
        while True:
            with self._lock:
                ok_req = self._rpm_budget.take(1) if self._rpm_budget.capacity > 0 else True
                ok_tok = self._tpm_budget.take(token_cost) if self._tpm_budget.capacity > 0 else True
                if ok_req and ok_tok:
                    return
                # if not enough budget, figure out minimal time to wait
                self._rpm_budget.refresh_if_needed()
                self._tpm_budget.refresh_if_needed()
                wait_r = self._rpm_budget.time_until_reset() if not ok_req else 0.0
                wait_t = self._tpm_budget.time_until_reset() if not ok_tok else 0.0
                wait = max(0.05, min(w for w in (wait_r, wait_t) if w > 0) if (not ok_req or not ok_tok) else 0.05)
            time.sleep(wait)

    def _call_with_retries(self, fn: Callable[[], object]) -> object:
        backoff = 0.5
        last: Optional[Exception] = None
        for attempt in range(self._max_retries):
            try:
                return fn()
            except Exception as e:  # handle OpenAI transient errors & 429
                last = e
                # Extract retry-after if present
                retry_after: Optional[float] = None
                try:
                    headers = None
                    # openai>=1.0 exceptions often have .response.headers
                    resp = getattr(e, "response", None)
                    if resp is not None:
                        headers = getattr(resp, "headers", None)
                    if headers:
                        ra = headers.get("retry-after") or headers.get("Retry-After")
                        if ra is not None:
                            retry_after = float(ra)
                except Exception:
                    retry_after = None

                wait = retry_after if (retry_after is not None) else min(backoff, 10)
                wait = float(wait) + random.uniform(0, 0.25)
                time.sleep(max(0.05, wait))
                backoff = min(backoff * 2, 10)
        # if we exhausted retries, re-raise the last
        if last is not None:
            raise last
        # Should not reach here
        return fn()

    def execute(self, token_cost: int, fn: Callable[[], object]) -> object:
        # Concurrency gate first to avoid over-queuing
        self._sem.acquire()
        try:
            # Wait until budgets allow
            self._await_budgets(token_cost)
            # Perform call with retries
            result = self._call_with_retries(fn)
            with self._lock:
                self._completed += 1
            return result
        finally:
            try:
                self._sem.release()
            except Exception:
                pass


def estimate_tokens(text: str, max_output_tokens: int = 512) -> int:
    """Rough estimation: ~4 chars per token + output cap."""
    n = len(text or "")
    return int(math.ceil(n / 4.0)) + int(max_output_tokens or 0)


def estimate_eta(
    items: int,
    avg_tokens_per_call: int = 1500,
    calls_per_item: float = 2.0,
    p95_latency_sec: float = 2.5,
) -> Tuple[float, float]:
    """
    Returns (effective_rate_req_per_min, minutes) for processing `items`.
    """
    items = max(0, int(items))
    calls = max(0.0, float(calls_per_item)) * items
    rpm = max(1, int(os.getenv("LLM_RPM", str(_DEFAULT_RPM))))
    tpm = max(1, int(os.getenv("LLM_TPM", str(_DEFAULT_TPM))))
    conc = max(1, int(os.getenv("LLM_CONCURRENCY", str(_DEFAULT_CONCURRENCY))))

    r1 = rpm
    r2 = max(1, int(tpm // max(1, int(avg_tokens_per_call))))
    r3 = max(1, int((conc * 60) // max(1, int(p95_latency_sec))))
    effective_rate = max(1, min(r1, r2, r3))  # requests per minute
    minutes = (calls / effective_rate) if calls > 0 else 0.0
    return float(effective_rate), float(minutes)


# Defaults can be tuned via env
_DEFAULT_RPM = _env_int("LLM_RPM", 60)
_DEFAULT_TPM = _env_int("LLM_TPM", 300_000)
_DEFAULT_CONCURRENCY = _env_int("LLM_CONCURRENCY", 10)
_DEFAULT_RETRIES = _env_int("LLM_MAX_RETRIES", 6)


# Global limiter instance
global_limiter = RateLimiter(
    rpm=_DEFAULT_RPM,
    tpm=_DEFAULT_TPM,
    concurrency=_DEFAULT_CONCURRENCY,
    max_retries=_DEFAULT_RETRIES,
)

