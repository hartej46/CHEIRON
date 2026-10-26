from pathlib import Path

from model_and_loops.model import RPSModel
import torch

MODEL_PATH = Path(__file__).resolve().parent.parent / "model" / "rps_model.pth"

model = RPSModel()
model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))

device = torch.device("cuda" if torch.cuda.is_available() else  "mps" if torch.backends.mps.is_available() else "cpu")

model.to(device)
model.eval()


def predict(coordinates: list[float]) -> tuple[int, str]:
    coordinates_tensor = torch.tensor(
        [coordinates],
        dtype=torch.float32,
        device=device,
    )

    options = ['paper', 'rock', 'scissors']
    with torch.inference_mode():
        scores = model(coordinates_tensor)
        predicted_index = torch.argmax(scores, dim=1).item()
        
    return int(predicted_index) , options[int(predicted_index)]