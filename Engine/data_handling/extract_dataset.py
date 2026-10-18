import os
import cv2
import csv
import mediapipe as mp

# 1. Initialize MediaPipe Hands in static image mode
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=True,
    max_num_hands=1,
    min_detection_confidence=0.5
)

# Define your input directories and the label for each
# Adjust these paths to match where you extracted your downloaded dataset
DATASET_PATHS = {
    "rock": "./dataset/rock",
    "paper": "./dataset/paper",
    "scissors": "./dataset/scissors"
}

OUTPUT_CSV = "hand_coordinates_dataset.csv"

def process_images():
    total_processed = 0
    total_skipped = 0

    # 2. Open the CSV file for writing
    with open(OUTPUT_CSV, mode='w', newline='') as file:
        writer = csv.writer(file)
        
        # Create headers: 'label', 'x0', 'y0', 'z0', 'x1', 'y1', 'z1' ... up to z20
        headers = ["label"] + [f"{axis}{i}" for i in range(21) for axis in ('x', 'y', 'z')]
        writer.writerow(headers)

        # 3. Iterate through each class folder
        for label, folder_path in DATASET_PATHS.items():
            if not os.path.exists(folder_path):
                print(f"Directory not found: {folder_path}")
                continue

            for filename in os.listdir(folder_path):
                if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                    continue

                filepath = os.path.join(folder_path, filename)
                
                # Load image with OpenCV
                image = cv2.imread(filepath)
                if image is None:
                    continue

                # MediaPipe requires RGB format; OpenCV loads as BGR
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

                # Process the image
                results = hands.process(image_rgb)

                # 4. Extract and flatten if a hand is found
                if results.multi_hand_landmarks:
                    # Grab the first detected hand
                    hand_landmarks = results.multi_hand_landmarks[0]
                    
                    row = [label]
                    for landmark in hand_landmarks.landmark:
                        row.extend([landmark.x, landmark.y, landmark.z])
                    
                    writer.writerow(row)
                    total_processed += 1
                else:
                    # If MediaPipe cannot confidently see a hand, discard the image
                    total_skipped += 1

    hands.close()
    print(f"Extraction complete! Successfully processed {total_processed} images.")
    print(f"Skipped {total_skipped} images where no clear hand was detected.")
    print(f"Data saved to {OUTPUT_CSV}")

if __name__ == "__main__":
    process_images()