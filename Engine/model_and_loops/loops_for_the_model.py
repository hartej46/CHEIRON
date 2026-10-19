import torch
from torch import nn

def training_loop(
    model : nn.Module,
    optimizer : torch.optim.Optimizer,
    loss_fn : nn.Module,
    train_loader : torch.utils.data.DataLoader,
    val_loader : torch.utils.data.DataLoader):

    model.train()

    
    