from collections import Counter
from src.predict import predict as run_prediction


def evaluate(coordinates: list[list[float]] | list[float]) -> tuple[int, str] | None:
    if not coordinates:
        return None

    # If a single frame (list of 63 floats) is passed, wrap in list
    if coordinates and isinstance(coordinates[0], (int, float)):
        if len(coordinates) == 63:
            try:
                return run_prediction(coordinates)  # type: ignore
            except Exception:
                return None
        return None

    predictions: list[tuple[int, str]] = []
    for sample in coordinates:
        if isinstance(sample, list) and len(sample) == 63:
            try:
                pred = run_prediction(sample)  # type: ignore
                if pred is not None:
                    predictions.append(pred)
            except Exception:
                continue

    if not predictions:
        return None

    counts = Counter(predictions)
    most_common = counts.most_common(1)
    if not most_common:
        return None

    most_common_pred, count = most_common[0]

    if count >= 3:
        return most_common_pred

    return None
