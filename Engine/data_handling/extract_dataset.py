import os
import csv
import urllib.request
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

                # 5. Extract and flatten if a hand is found
                if detection_result.hand_landmarks:
                  hand_landmarks = detection_result.hand_landmarks[0]

                  row = [label]
                  for landmark in hand_landmarks:
                    row.extend([landmark.x, landmark.y, landmark.z])

                  writer.writerow(row)
                  total_processed += 1
                else:
                  total_skipped += 1

                print(f"Processed: {total_processed}, Skipped: {total_skipped}")

if __name__ == "__main__":
    process_images()
    detector.close() # <--- Add this line to manually close the model
    