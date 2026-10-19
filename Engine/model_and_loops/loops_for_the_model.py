import torch
from torch import nn

def training_loop(
    model : nn.Module,
    optimizer : torch.optim.Optimizer,
    loss_fn : nn.Module,
    train_loader : torch.utils.data.DataLoader,
    epochs : int = 10):

    model.train()

    training_losses = []

    for epoch in range(epochs):

        running_loss = 0.0

        for X,y in train_loader:

            X = X.to(model.device)
            y = y.to(model.device)

            y_pred = model(X)

            loss = loss_fn(y_pred, y)
            running_loss += loss.item()

            optimizer.zero_grad()

            loss.backward()

            optimizer.step()

        running_loss /= len(train_loader)
        training_losses.append(running_loss)

    return training_losses



    
    