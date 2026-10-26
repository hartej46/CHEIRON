from fastapi import FastAPI
from pydantic import BaseModel, Field
import uvicorn

from src.predict import predict as run_prediction

app = FastAPI()


class PredictionRequest(BaseModel):
    coordinates: list[float] = Field(
        min_length=63,
        max_length=63,
        description="21 hand landmarks flattened as x, y, z values",
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.post("/predict")
def predict(request: PredictionRequest) -> dict[str, int | str]:
    predicted_index, predicted_option = run_prediction(request.coordinates)
    return {
        "index": predicted_index,
        "prediction": predicted_option,
    }

if __name__ == "__main__":
    uvicorn.run("src.app:app", host="0.0.0.0", port=8000)
