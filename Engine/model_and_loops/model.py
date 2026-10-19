import torch
from torch import nn

class RPSModel(nn.Module):
    def __init__(self):
        super().__init__()

        self.block = nn.Sequential(
            nn.Linear(63, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 3)  # Output layer for 3 classes: rock, paper, scissors
            
        )



    def forward(self, x):

        x = self.block(x)
        return x    


if __name__ == "__main__":

    model = RPSModel()

    dummy_input = torch.randn(1, 63)
    
    output = model(dummy_input)
    print("Output shape:", output.shape) # Should be [1, 3]