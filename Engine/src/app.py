from fastapi import FastAPI
from pydantic import BaseModel, Field
import uvicorn

from src.evaluate import evaluate as run_evaluation

app = FastAPI()


class PredictionRequest(BaseModel):
    coordinates: list[list[float]] | list[float] = Field(
        description="Either 5 frames of 63 hand landmarks or a single flattened 63-element frame",
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.post("/predict")
def predict(request: PredictionRequest) -> dict[str, int | str]:
    evaluation = run_evaluation(request.coordinates)

    if evaluation is None:
        return {
            "success": False,
            "prediction": "None",
            "index": -1,
            "message": "No confident prediction",
        }

    predicted_index, predicted_option = evaluation
    return {
        "success": True,
        "prediction": predicted_option,
        "index": predicted_index,
    }

if __name__ == "__main__":
    uvicorn.run("src.app:app", host="0.0.0.0", port=8000)
