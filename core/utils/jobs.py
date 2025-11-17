import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional


@dataclass
class JobState:
    id: str
    status: str = "queued"  # queued | running | done | error
    message: str = ""
    created_at: float = field(default_factory=lambda: time.time())
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    total: int = 0
    completed: int = 0
    percent: float = 0.0
    eta_minutes: Optional[float] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    cancel_requested: bool = False
    cancelled_at: Optional[float] = None


class JobManager:
    def __init__(self) -> None:
        self._jobs: Dict[str, JobState] = {}
        self._lock = threading.Lock()

    def _calc_percent(self, completed: int, total: int) -> float:
        if total <= 0:
            return 0.0
        return max(0.0, min(100.0, (completed / max(1, total)) * 100.0))

    def create(self, *, total: int = 0, message: str = "") -> JobState:
        job_id = str(uuid.uuid4())
        st = JobState(id=job_id, total=max(0, int(total)), message=message)
        with self._lock:
            self._jobs[job_id] = st
        return st

    def get(self, job_id: str) -> Optional[JobState]:
        with self._lock:
            return self._jobs.get(job_id)

    def start(self, job_id: str, message: str = "") -> None:
        with self._lock:
            st = self._jobs.get(job_id)
            if not st:
                return
            st.status = "running"
            st.started_at = time.time()
            if message:
                st.message = message

    def update(self, job_id: str, *, completed: Optional[int] = None, total: Optional[int] = None,
               message: Optional[str] = None, eta_minutes: Optional[float] = None) -> None:
        with self._lock:
            st = self._jobs.get(job_id)
            if not st:
                return
            if total is not None:
                st.total = max(0, int(total))
            if completed is not None:
                st.completed = max(0, int(completed))
            if message is not None:
                st.message = message
            if eta_minutes is not None:
                st.eta_minutes = float(eta_minutes)
            st.percent = self._calc_percent(st.completed, st.total)

    def done(self, job_id: str, result: Dict[str, Any]) -> None:
        with self._lock:
            st = self._jobs.get(job_id)
            if not st:
                return
            st.status = "done"
            st.finished_at = time.time()
            st.result = result
            st.percent = self._calc_percent(st.completed, st.total)

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            st = self._jobs.get(job_id)
            if not st:
                return
            st.status = "error"
            st.finished_at = time.time()
            st.error = error

    # -------- cancellation support --------
    def cancel(self, job_id: str) -> None:
        """Mark a job as cancel requested. The running worker should check and stop ASAP."""
        with self._lock:
            st = self._jobs.get(job_id)
            if not st:
                return
            st.cancel_requested = True
            st.message = st.message or "cancel requested"

    def is_cancel_requested(self, job_id: str) -> bool:
        with self._lock:
            st = self._jobs.get(job_id)
            return bool(st and st.cancel_requested)

    def cancelled(self, job_id: str, partial_result: Optional[Dict[str, Any]] = None) -> None:
        with self._lock:
            st = self._jobs.get(job_id)
            if not st:
                return
            st.status = "cancelled"
            st.cancelled_at = time.time()
            st.finished_at = st.cancelled_at
            if partial_result is not None:
                st.result = partial_result
            st.error = (st.error or "Cancelled by user")

    def spawn(self, job: JobState, target: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
        def _runner():
            try:
                self.start(job.id, message="running")
                result = target(job, *args, **kwargs)
                # target may already mark as cancelled; only set done if still active
                with self._lock:
                    st = self._jobs.get(job.id)
                    already_final = st and st.status in {"done", "error", "cancelled"}
                if not already_final:
                    self.done(job.id, result=result if isinstance(result, dict) else {"result": result})
            except Exception as e:
                self.fail(job.id, error=str(e))

        t = threading.Thread(target=_runner, daemon=True)
        t.start()


job_manager = JobManager()
