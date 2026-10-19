import urllib.request
import zipfile
import os

# Create a directory to store the dataset
dataset_dir = "./Engine/data/rock_paper_scissors"
os.makedirs(dataset_dir, exist_ok=True)

# UPDATED: The new official TensorFlow storage URLs
train_url = "https://storage.googleapis.com/download.tensorflow.org/data/rps.zip"
test_url = "https://storage.googleapis.com/download.tensorflow.org/data/rps-test-set.zip"

train_zip_path = os.path.join(dataset_dir, "rps.zip")
test_zip_path = os.path.join(dataset_dir, "rps-test-set.zip")

# Download the training and testing sets
print("Downloading training data...")
urllib.request.urlretrieve(train_url, train_zip_path)

print("Downloading test data...")
urllib.request.urlretrieve(test_url, test_zip_path)
# Extract the files
print("Extracting training data...")
with zipfile.ZipFile(train_zip_path, 'r') as zip_ref:
    zip_ref.extractall(dataset_dir)

print("Extracting test data...")
with zipfile.ZipFile(test_zip_path, 'r') as zip_ref:
    zip_ref.extractall(dataset_dir)

# Clean up the zip files to save space
os.remove(train_zip_path)
os.remove(test_zip_path)

print("Download and extraction complete!")