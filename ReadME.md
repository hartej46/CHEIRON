# CHEIRON

**Real-Time AI-Powered WebRTC Rock-Paper-Scissors Arena**

> **Contributors:**  
> - **Jay Patil** (IIT Jodhpur) — [@yay1503](https://github.com/yay1503)  
> - **Hartejsingh Sandhu** (NST Pune) — [@hartej46](https://github.com/hartej46)

---

## Overview

**CHEIRON** is an interactive, Omegle-style peer-to-peer video chat and gaming platform where strangers are matched in real time to compete in **Rock-Paper-Scissors** using live physical hand gestures. 

Instead of clicking buttons, players simply show their hands to their webcams. CHEIRON captures and tracks 21 three-dimensional hand landmarks directly in the browser using Google MediaPipe and evaluates the moves with a dedicated PyTorch deep neural network backend.

---

## Key Features

- **P2P Video Chat with WebRTC**: Ultra-low-latency video and audio streaming between matched opponents using WebRTC peer connections and STUN servers.
- **In-Browser Hand Tracking**: Client-side computer vision with `@mediapipe/tasks-vision`, tracking 21 hand landmarks ($x, y, z \rightarrow 63$ float features) at 60 FPS without transferring raw video bytes to the server.
- **Deep Learning Gesture Classifier**: A specialized PyTorch multi-layer perceptron (MLP) deployed as a microservice on FastAPI that classifies landmark coordinates into **Rock**, **Paper**, or **Scissors** with multi-frame majority voting.
- **Anti-Peeking "Blind" Phase**: Synchronized server-and-client blackout phase during the final second of each round that obscures the opponent's video display, completely preventing visual copying or cheating while maintaining the underlying WebRTC media stream.
- **Celebratory Inter-Round Break**: 5-second buffer between rounds featuring dynamic celebration cards for round winners, defeat cards for round losers, and camera dimming during the break before automatically transitioning to the next round.
- **Full Match Lifecycle**: Best-of-5 rounds progression, live scoreboards, match conclusion banners, and one-click "Next Partner" matchmaking.
- **Session Continuity**: Guest player profiles with persistent user IDs and custom nickname updates.

---

## System Architecture

CHEIRON is built as a modular 3-tier architecture:

```
┌────────────────────────────────────────────────────────┐
│                   FRONTEND (Vercel)                    │
│   React 19 • Vite • TypeScript • MediaPipe Vision      │
│   WebRTC P2P Video Stream • Lucide Icons               │
└──────────────┬───────────────────────────▲─────────────┘
               │                           │
  WebRTC SDP / │ Sockets                   │ Live P2P
  Signaling &  │ Coordinates               │ Video/Audio
  Game State   │                           │
               ▼                           │
┌──────────────────────────────┐           │
│      BACKEND (Render)        │           │
│  Node.js • Fastify • Sockets │           │
│  Matchmaking Queue & State   │           │
└──────────────┬───────────────┘           │
               │                           │
               │ HTTP POST /predict        │
               ▼                           │
┌──────────────────────────────┐           │
│     ML ENGINE (Render)       │           │
│  Python 3.11 • FastAPI       │           │
│  PyTorch Deep Neural Network ├───────────┘
└──────────────────────────────┘
```

1. **Frontend (`/Frontend`)**:
   - Built with React 19, TypeScript, and Vite.
   - Manages media acquisition (camera & mic permissions).
   - Runs MediaPipe Tasks Vision WebAssembly worker for hand tracking.
   - Coordinates WebRTC PeerConnection, STUN candidate negotiation, and remote stream rendering.
   - Handles game UI, countdowns, blind-phase obscuring, celebration banners, and sound/visual states.

2. **Backend (`/Backend`)**:
   - Built with Fastify and Socket.IO in TypeScript.
   - Manages player matchmaking pool, room isolation, and accidental disconnect handling.
   - Orchestrates WebRTC signaling (SDP offer/answer and ICE candidate exchange).
   - Enforces game state rules: 10s warmup, 5s round action countdown, 3.5s blind phase trigger, coordinate collection, and best-of-5 round transitions.
   - Communicates with the ML Engine via REST for gesture evaluation and score updating.

3. **Machine Learning Engine (`/Engine`)**:
   - Built with Python 3.11, FastAPI, Uvicorn, and PyTorch.
   - Loads a pre-trained `RPSModel` deep neural network (`rps_model.pth`).
   - Receives batches of landmark coordinate vectors from the backend.
   - Runs inference on each frame and applies temporal majority voting ($k \ge 3$) to return high-confidence gesture predictions.

---

## Round & Match Lifecycle

```
[ Match Found ]
       │
       ▼
[ Warmup Phase (10s) ] ──── Both players meet & say hello
       │
       ▼
[ Round Action (5s) ]  ──── Position hand, timer counts down
       │
       ▼
[ Blind Blackout (1s) ] ─── Opponent screen blacked out (Anti-Peeking)
       │                    5 coordinate frames captured & submitted
       ▼
[ ML Evaluation ] ───────── Backend evaluates gestures via PyTorch
       │
       ▼
[ Round Break (5s) ] ────── Black screen removed, cameras restored
       │                    Winner Celebration / Defeat card shown
       │                    Camera dimmed during break
       ▼
[ Round < 5 ? ] ─────────── Yes ──► Next Round
       │
       No
       ▼
[ Match Finished ] ──────── Winner declared (Best of 5)
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v18+` or `v20+`
- **npm** / **yarn** / **pnpm**
- **Python**: `3.10` or `3.11`
- **Git**

---

### 1. Clone the Repository

```bash
git clone https://github.com/hartej46/CHEIRON.git
cd CHEIRON
```

---

### 2. Setup the ML Engine

```bash
cd Engine
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the FastAPI engine
uvicorn src.app:app --host 0.0.0.0 --port 8000 --reload
```

The ML service will be available at `http://localhost:8000` (Health check: `http://localhost:8000/health`).

---

### 3. Setup the Backend

Open a new terminal window:

```bash
cd Backend
npm install

# Create environment file
cat <<EOF > .env
PORT=3000
NODE_ENV=development
JWT_TOKEN_SECERT=cheiron_secret_jwt_key
JWT_TOKEN_EXPIRY=1d
PLAYER_DETAILS_DELETE_TIME=3600000
FRONTEND_URL=http://localhost:5173
ML_SERVICE_URL=http://localhost:8000
EOF

# Start backend server
npm start
```

The backend server will run on `http://localhost:3000`.

---

### 4. Setup the Frontend

Open a third terminal window:

```bash
cd Frontend
npm install

# Create frontend environment file
cat <<EOF > .env
VITE_BACKEND_URL=http://localhost:3000
EOF

# Start Vite dev server
npm run dev
```

Open `http://localhost:5173` in two different browser windows (or an incognito window) to test multiplayer matching!

---

## Tech Stack

| Component | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, WebRTC, MediaPipe Tasks Vision, Socket.IO Client, Lucide React |
| **Backend** | Node.js, Fastify, Socket.IO, TypeScript, WebRTC Signaling |
| **ML Engine** | Python 3.11, PyTorch, FastAPI, Uvicorn, MediaPipe Python, Scikit-Learn |
| **Cloud & Deployment** | Vercel (Frontend), Render (Backend & Python ML Engine) |

---

## Authors & Credits

- **Jay Patil** — Indian Institute of Technology (IIT) Jodhpur — [@yay1503](https://github.com/yay1503)
- **Hartejsingh Sandhu** — Newton School of Technology (NST) Pune — [@hartej46](https://github.com/hartej46)

---

## License

This project is licensed under the MIT License — see the LICENSE file for details.
