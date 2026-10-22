import torch
from torch import nn

def training_loop(
    model : nn.Module,
    optimizer : torch.optim.Optimizer,
    loss_fn : nn.Module,
    train_loader : torch.utils.data.DataLoader,
    epochs : int = 10,
    device : torch.device = None):

    if device is None:
        device = torch.device(
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    model.train()

    training_losses = []
    training_accuracies = []

    for epoch in range(epochs):
        running_loss = 0.0
        correct = 0
        total = 0

        for X,y in train_loader:

            X = X.to(device)
            y = y.to(device)

            y_pred = model(X)

            loss = loss_fn(y_pred, y)
            running_loss += loss.item()

            optimizer.zero_grad()

            loss.backward()

            optimizer.step()
            predictions = y_pred.argmax(dim=1)
            correct += (predictions == y).sum().item()
            total += y.size(0)
        epoch_loss = running_loss / len(train_loader)
        epoch_accuracy = correct / total
        training_losses.append(epoch_loss)
        training_accuracies.append(epoch_accuracy)

        print(
            f"Epoch {epoch + 1}/{epochs}, "
            f"Loss: {epoch_loss:.4f}, "
            f"Accuracy: {epoch_accuracy * 100:.2f}%"
        )
    return training_losses, training_accuracies