from __future__ import annotations


def range_score(value: float, low: float, high: float, tolerance: float) -> float:
    """1.0 inside [low, high], decaying linearly to 0 at `tolerance` outside it."""
    return max(0.0, 1.0 - range_distance(value, low, high) / tolerance)


def range_distance(value: float, low: float, high: float) -> float:
    if value < low:
        return low - value
    if value > high:
        return value - high
    return 0.0


def nutrient_tolerance(low: float, high: float) -> float:
    return max(20.0, 0.5 * (low + high) / 2)


TOLERANCE = {"ph": 1.5, "temperature": 8.0, "moisture": 25.0}
