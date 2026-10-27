from collections import Counter
from src.predict import predict as run_prediction


def evaluate(coordinates: list[list[float]] | list[float]) -> tuple[int, str] | None:
    if not coordinates:
        return None

    # If a single frame (list of 63 floats) is passed, wrap in list
    if coordinates and isinstance(coordinates[0], (int, float)):
        return run_prediction(coordinates)  # type: ignore

    predictions: list[tuple[int, str]] = []
    for sample in coordinates:
        predictions.append(run_prediction(sample))  # type: ignore


    counts = Counter(predictions)
    most_common_pred, count = counts.most_common(1)[0]


    if count >= 3:
        return most_common_pred

    return None