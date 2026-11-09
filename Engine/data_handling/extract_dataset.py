import os
import csv
import urllib.request
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# 1. Download the required model bundle if it doesn't exist
MODEL_PATH = "hand_landmarker.task"
if not os.path.exists(MODEL_PATH):
    print("Downloading MediaPipe model bundle...")
    url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    urllib.request.urlretrieve(url, MODEL_PATH)

# 2. Initialize the modern MediaPipe Tasks HandLandmarker
base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=1,
    min_hand_detection_confidence=0.5
)
detector = vision.HandLandmarker.create_from_options(options)

# Adjust these paths to match where your dataset is extracted
DATASET_PATHS = {
    "rock": "./Engine/data/rock_paper_scissors/rps/rock",
    "paper": "./Engine/data/rock_paper_scissors/rps/paper",
    "scissors": "./Engine/data/rock_paper_scissors/rps/scissors"
}

OUTPUT_CSV = "./Engine/data/train_hand_coordinates_dataset.csv"

def normalize_hand_landmarks(landmarks_flat):
    """
    Normalizes hand coordinates to be invariant to position and scale.
    """
    # Reshape the flat list [x0, y0, z0, x1, y1, z1...] into a 21x3 matrix
    coords = np.array(landmarks_flat).reshape(21, 3)
    
    # Step A: Shift to Wrist Origin (Landmark 0)
    wrist = coords[0]
    shifted_coords = coords - wrist
    
    # Step B: Scale by Palm Length (Distance from wrist to Landmark 9)
    middle_finger_base = shifted_coords[9]
    # np.linalg.norm calculates the Euclidean distance automatically
    palm_length = np.linalg.norm(middle_finger_base)
    
    # Prevent division by zero in case of glitchy frame data
    if palm_length > 1e-6:
        normalized_coords = shifted_coords / palm_length
    else:
        normalized_coords = shifted_coords
        
    # Flatten back to a 1D array of 63 elements for the neural network
    return normalized_coords.flatten().tolist()

def process_images():
    total_processed = 0
    total_skipped = 0

    # Open the CSV file for writing
    with open(OUTPUT_CSV, mode='w', newline='') as file:
        writer = csv.writer(file)
        
        # Create headers: 'label', 'x0', 'y0', 'z0' ... up to z20
        headers = ["label"] + [f"{axis}{i}" for i in range(21) for axis in ('x', 'y', 'z')]
        writer.writerow(headers)

        for label, folder_path in DATASET_PATHS.items():
            if not os.path.exists(folder_path):
                print(f"Directory not found: {folder_path}")
                continue

            for filename in os.listdir(folder_path):
                if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                    continue

                filepath = os.path.join(folder_path, filename)
                
                try:
                    # 3. Load image directly using the new MediaPipe Image class
                    mp_image = mp.Image.create_from_file(filepath)
                except Exception as e:
                    print(f"Could not read {filepath}: {e}")
                    continue

                # 4. Process the image
                detection_result = detector.detect(mp_image)

                # 5. Extract, flatten, and normalize if a hand is found
                if detection_result.hand_landmarks:
                    hand_landmarks = detection_result.hand_landmarks[0]

                    raw_coords = []
                    for landmark in hand_landmarks:
                        raw_coords.extend([landmark.x, landmark.y, landmark.z])

                    # Apply normalization before writing to CSV
                    normalized_coords = normalize_hand_landmarks(raw_coords)
                    
                    row = [label] + normalized_coords
                    writer.writerow(row)
                    
                    total_processed += 1
                else:
                    total_skipped += 1

                # Print progress intermittently to avoid console spam
                if (total_processed + total_skipped) % 100 == 0:
                    print(f"Processed: {total_processed}, Skipped: {total_skipped}")
                    
    print(f"Final Count -> Processed: {total_processed}, Skipped: {total_skipped}")

if __name__ == "__main__":
    process_images()
    detector.close() # <--- Manually close the model