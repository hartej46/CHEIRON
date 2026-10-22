import torch
from torch import nn
import tqdm.auto as tqdm

def training_loop(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    loss_fn: nn.Module,
    train_loader: torch.utils.data.DataLoader,
    device: torch.device = None
):
    if device is None:
        device = torch.device(
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for X, y in tqdm.tqdm(train_loader, desc="Training"):
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
    
    return epoch_loss, epoch_accuracy

def validation_loop(
        model : nn.Module,
        loss_fn : nn.Module,
        val_loader : torch.utils.data.DataLoader,
        device : torch.device = None):

    if device is None:
        device = torch.device(
            "mps" if torch.backends.mps.is_available() else "cpu"
        )

    model.eval()
    with torch.inference_mode():

        val_loss = 0.0
        correct = 0
        total = 0

        for X,y in val_loader:

            X = X.to(device)
            y = y.to(device)

            y_pred = model(X)
            loss = loss_fn(y_pred, y)
            val_loss += loss.item()

            predictions = y_pred.argmax(dim=1)
            correct += (predictions == y).sum().item()
            total += y.size(0)

        val_loss /= len(val_loader)
        val_accuracy = correct / total

    return val_loss, val_accuracy

def train_and_validate(
        model : nn.Module,
        optimizer : torch.optim.Optimizer,
        loss_fn : nn.Module,
        train_loader : torch.utils.data.DataLoader,
        val_loader : torch.utils.data.DataLoader,
        epochs : int = 5,
        device : torch.device = None):

    history = {
        "train_loss": [],
        "train_acc": [],
        "val_loss": [],
        "val_acc": []
    }

    for epoch in range(epochs):

        train_loss, train_acc = training_loop(
            model=model,
            optimizer=optimizer,
            loss_fn=loss_fn,
            train_loader=train_loader,
            device=device
        )

        val_loss, val_acc = validation_loop(
            model=model,
            loss_fn=loss_fn,
            val_loader=val_loader,
            device=device
        )

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)


    return history

import matplotlib.pyplot as plt

def plot_history(history: dict):
    epochs = range(1, len(history["train_loss"]) + 1)

    fig, axs = plt.subplots(1, 2, figsize=(12, 5))

    # Plot Training and Validation Loss
    axs[0].plot(epochs, history["train_loss"], label="Train Loss", marker='o')
    axs[0].plot(epochs, history["val_loss"], label="Validation Loss", marker='o')
    axs[0].set_title("Training and Validation Loss")
    axs[0].set_xlabel("Epochs")
    axs[0].set_ylabel("Loss")
    axs[0].legend()
    axs[0].grid(True)

    # Plot Training and Validation Accuracy
    axs[1].plot(epochs, history["train_acc"], label="Train Accuracy", marker='o')
    axs[1].plot(epochs, history["val_acc"], label="Validation Accuracy", marker='o')
    axs[1].set_title("Training and Validation Accuracy")
    axs[1].set_xlabel("Epochs")
    axs[1].set_ylabel("Accuracy")
    axs[1].legend()
    axs[1].grid(True)

    plt.tight_layout()
    plt.show()