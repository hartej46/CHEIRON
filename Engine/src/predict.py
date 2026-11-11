from pathlib import Path
import numpy as np
import torch

from model_and_loops.model import RPSModel

MODEL_PATH = Path(__file__).resolve().parent.parent / "model" / "rps_model.pth"

model = RPSModel()
model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))

device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")

model.to(device)
model.eval()

def normalize_hand_landmarks(landmarks_flat: list[float]) -> list[float]:
    """
    Normalizes hand coordinates to be invariant to position and scale.
    """
    coords = np.array(landmarks_flat).reshape(21, 3)
    
    # Step A: Shift to Wrist Origin (Landmark 0)
    wrist = coords[0]
    shifted_coords = coords - wrist
    
    # Step B: Scale by Palm Length (Distance from wrist to Landmark 9)
    middle_finger_base = shifted_coords[9]
    palm_length = np.linalg.norm(middle_finger_base)
    
    if palm_length > 1e-6:
        normalized_coords = shifted_coords / palm_length
    else:
        normalized_coords = shifted_coords
        
    return normalized_coords.flatten().tolist()

def predict(coordinates: list[float]) -> tuple[int, str]:
    # 1. Normalize the raw incoming webcam coordinates
    normalized_coords = normalize_hand_landmarks(coordinates)

    # 2. Feed the normalized coordinates to the PyTorch model
    coordinates_tensor = torch.tensor(
        [normalized_coords],
        dtype=torch.float32,
        device=device,
    )

    options = ['paper', 'rock', 'scissors']
    with torch.inference_mode():
        scores = model(coordinates_tensor)
        predicted_index = torch.argmax(scores, dim=1).item()
        
    return int(predicted_index), options[int(predicted_index)]