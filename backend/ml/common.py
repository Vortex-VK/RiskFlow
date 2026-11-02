"""Inference synchronization and errors shared by current and historical engines."""

from threading import RLock

LOCK = RLock()


class ModelUnavailable(RuntimeError):
    pass
