from model_and_loops.model import RPSModel
import torch
from torch import nn

model = RPSModel()
model.load_state_dict(torch.load("Engine/model/rps_model.pth"))

device = torch.device("cuda" if torch.cuda.is_available() else  "mps" if torch.backends.mps.is_available() else "cpu")

model.to(device)


