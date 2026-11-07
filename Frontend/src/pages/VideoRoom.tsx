import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { io, type Socket } from "socket.io-client";
import { useNickname } from "../context/NicknameContext";
import { initPlayer, getSessionDetails } from "../service/service";
import { ProfileModal } from "../components/ProfileModal";

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const HAND_HIGHLIGHT_LANDMARKS = [0, 4, 8, 12, 16, 20];
const LANDMARK_VALUE_COUNT = 63;

export function VideoRoom() {
    const { nickname, setUserData } = useNickname();
    const navigate = useNavigate();

    // Media References
    const videoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);

    // WebRTC & Socket References
    const socketRef = useRef<Socket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const roomIdRef = useRef<string | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const latestCoordinatesRef = useRef<number[] | null>(null);
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const detectionFrameRef = useRef<number | null>(null);
    const isRoundActiveRef = useRef(false);
    const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const captureSamplesRef = useRef<number[][]>([]);
    const captureTickCountRef = useRef(0);

    // Media State
    const [hasMediaPermissions, setHasMediaPermissions] = useState<boolean | null>(null);
    const [mediaError, setMediaError] = useState<string | null>(null);

    // Call / Match State: 'searching' | 'connected' | 'stopped'
    const [callState, setCallState] = useState<"searching" | "connected" | "stopped">("searching");
    const [connectionStatus, setConnectionStatus] = useState("Initializing camera & microphone...");
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [opponentNickname, setOpponentNickname] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);
    const [gamePhase, setGamePhase] = useState<
        "waiting" | "warmup" | "action" | "round_break" | "game_over"
    >("waiting");
    const [timer, setTimer] = useState(0);
    const [round, setRound] = useState(0);
    const [scores, setScores] = useState({ user: 0, opponent: 0 });
    const [matchWinner, setMatchWinner] = useState<string | null>(null);
    const [isBlindPhase, setIsBlindPhase] = useState(false);
    const [lastRoundResult, setLastRoundResult] = useState<{
        winner: "user" | "opponent" | "draw";
        userMove: string;
        opponentMove: string;
        reason: string;
        round: number;
    } | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureSampleCount, setCaptureSampleCount] = useState(0);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const [isLandmarkerReady, setIsLandmarkerReady] = useState(false);

    useEffect(() => {
        isRoundActiveRef.current = gamePhase === "action";
        if (!isRoundActiveRef.current) {
            // Coordinates are only meaningful during the action phase.
            latestCoordinatesRef.current = null;
        }
    }, [gamePhase]);

    useEffect(() => {
        if (!hasMediaPermissions || !streamRef.current) return;

        let cancelled = false;
        setIsLandmarkerReady(false);
        const initializeLandmarker = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    `${window.location.origin}/wasm`
                );
                const landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    },
                    runningMode: "VIDEO",
                    numHands: 1,
                });

                if (cancelled) {
                    landmarker.close();
                    return;
                }
                landmarkerRef.current = landmarker;
                setIsLandmarkerReady(true);
                setCaptureError((prev) => (prev?.includes("tracking") ? null : prev));
            } catch (error) {
                console.error("Unable to initialize MediaPipe hand tracking.", error);
                setCaptureError(
                    "Unable to initialize hand tracking. Check your connection and reload the page."
                );
            }
        };

        void initializeLandmarker();

        return () => {
            cancelled = true;
            if (detectionFrameRef.current !== null) {
                cancelAnimationFrame(detectionFrameRef.current);
                detectionFrameRef.current = null;
            }
            landmarkerRef.current?.close();
            landmarkerRef.current = null;
            setIsLandmarkerReady(false);
        };
    }, [hasMediaPermissions]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        const video = videoRef.current;

        if (!canvas || !context || !video) return;

        const clearCanvas = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
        };

        const detectFrame = () => {
            clearCanvas();
            const landmarker = landmarkerRef.current;

            try {
                if (
                    landmarker &&
                    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
                    video.videoWidth > 0 &&
                    video.videoHeight > 0
                ) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;

                    const result = landmarker.detectForVideo(video, performance.now());
                    const landmarks = result.landmarks[0];

                    if (isRoundActiveRef.current) {
                        latestCoordinatesRef.current = landmarks
                            ? landmarks.flatMap(({ x, y, z }) => [x, y, z])
                            : null;
                    }

                    if (landmarks) {
                        setCaptureError((prev) => (prev ? null : prev));
                        context.strokeStyle = "#00ffff";
                        context.lineWidth = 3;
                        context.shadowColor = "#00ffff";
                        context.shadowBlur = 10;
                        context.lineCap = "round";
                        context.lineJoin = "round";

                        for (const [start, end] of HAND_CONNECTIONS) {
                            const startLandmark = landmarks[start];
                            const endLandmark = landmarks[end];
                            if (!startLandmark || !endLandmark) continue;

                            context.beginPath();
                            context.moveTo(
                                startLandmark.x * canvas.width,
                                startLandmark.y * canvas.height
                            );
                            context.lineTo(
                                endLandmark.x * canvas.width,
                                endLandmark.y * canvas.height
                            );
                            context.stroke();
                        }

                        context.fillStyle = "#ffffff";
                        context.shadowBlur = 12;
                        for (const index of HAND_HIGHLIGHT_LANDMARKS) {
                            const landmark = landmarks[index];
                            if (!landmark) continue;

                            context.beginPath();
                            context.arc(
                                landmark.x * canvas.width,
                                landmark.y * canvas.height,
                                5,
                                0,
                                Math.PI * 2
                            );
                            context.fill();
                        }
                        context.shadowBlur = 0;
                    }
                }
            } catch (error) {
                console.error("MediaPipe hand detection failed for a frame.", error);
            }

            detectionFrameRef.current = requestAnimationFrame(detectFrame);
        };

        detectionFrameRef.current = requestAnimationFrame(detectFrame);
        return () => {
            if (detectionFrameRef.current !== null) {
                cancelAnimationFrame(detectionFrameRef.current);
                detectionFrameRef.current = null;
            }
            clearCanvas();
        };
    }, [hasMediaPermissions]);

    // Call Duration Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (callState === "connected" && remoteStream) {
            interval = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callState, remoteStream]);

    // Timer countdown effect for active phases (warmup, action, round break)
    useEffect(() => {
        if (gamePhase !== "warmup" && gamePhase !== "action" && gamePhase !== "round_break") return;

        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(interval);
    }, [gamePhase]);

    // Auto-dismiss capture error after 3.5 seconds
    useEffect(() => {
        if (!captureError) return;
        const dismissTimer = setTimeout(() => {
            setCaptureError(null);
        }, 3500);
        return () => clearTimeout(dismissTimer);
    }, [captureError]);

    // Capture landmark samples during the action phase.
    useEffect(() => {
        if (gamePhase !== "action") return;

        const video = videoRef.current;
        if (!video || !landmarkerRef.current) {
            setCaptureError("Hand tracking is initializing...");
            return;
        }

        captureSamplesRef.current = [];
        captureTickCountRef.current = 0;
        setCaptureSampleCount(0);
        setCaptureError(null);
        setIsCapturing(true);

        const finishCapture = () => {
            if (captureIntervalRef.current !== null) {
                clearInterval(captureIntervalRef.current);
                captureIntervalRef.current = null;
            }

            setIsCapturing(false);

            const samples = captureSamplesRef.current;
            let finalCoordinates: number[][] = [];

            if (samples.length > 0) {
                // Use the most recent captured samples (up to 5)
                const recent = samples.slice(-5);
                // Pad up to 5 if fewer samples were captured
                while (recent.length < 5) {
                    recent.push([...recent[recent.length - 1]]);
                }
                finalCoordinates = recent;
            } else {
                // If no hand was detected during the window, submit empty array
                // so the backend evaluates gracefully and the round does not stall
                finalCoordinates = [];
                setCaptureError("No hand detected for this round.");
            }

            if (!socketRef.current || !roomIdRef.current) {
                setCaptureError("Unable to submit hand coordinates.");
                return;
            }

            socketRef.current.emit("submit_coordinates", {
                roomId: roomIdRef.current,
                coordinates: finalCoordinates,
            });
        };

        // Sample every 150ms over ~4.8 seconds (32 ticks total for 5s round)
        const TOTAL_SAMPLE_TICKS = 32;
        // Trigger blind phase at ~3.5 seconds (tick 24 * 150ms = 3600ms)
        const BLIND_PHASE_TICK = 24;

        captureIntervalRef.current = setInterval(() => {
            captureTickCountRef.current += 1;
            const currentTick = captureTickCountRef.current;

            // Client-side backup to ensure remote view is obscured at 3.5s
            if (currentTick >= BLIND_PHASE_TICK) {
                setIsBlindPhase(true);
            }

            const coordinates = latestCoordinatesRef.current;
            if (coordinates && coordinates.length === LANDMARK_VALUE_COUNT) {
                captureSamplesRef.current.push([...coordinates]);
                setCaptureSampleCount(captureSamplesRef.current.length);
                setCaptureError((prev) => (prev ? null : prev));
            }

            if (currentTick >= TOTAL_SAMPLE_TICKS) {
                finishCapture();
            }
        }, 150);

        return () => {
            if (captureIntervalRef.current !== null) {
                clearInterval(captureIntervalRef.current);
                captureIntervalRef.current = null;
            }
            captureSamplesRef.current = [];
            captureTickCountRef.current = 0;
            setIsCapturing(false);
        };
    }, [gamePhase, isLandmarkerReady]);



    // Format duration MM:SS
    const formatDuration = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // Attach local stream to video element
    useEffect(() => {
        if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [hasMediaPermissions]);

    // Attach remote stream to remote video element
    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            if (remoteStream) {
                void remoteVideoRef.current.play().catch(() => {
                    setConnectionStatus("Click the page to allow remote video playback.");
                });
            }
        }
    }, [remoteStream]);

    // Helper: Teardown PeerConnection
    const teardownPeerConnection = useCallback(() => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.onicecandidate = null;
            peerConnectionRef.current.ontrack = null;
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        pendingCandidatesRef.current = [];
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        remoteStreamRef.current = null;
        setRemoteStream(null);
        setOpponentNickname(null);
        setGamePhase("waiting");
        setTimer(0);
        setRound(0);
        setScores({ user: 0, opponent: 0 });
        setMatchWinner(null);
        setIsBlindPhase(false);
        setLastRoundResult(null);
    }, []);

    // Setup WebRTC PeerConnection
    const setupPeerConnection = useCallback(() => {
        if (peerConnectionRef.current) return peerConnectionRef.current;

        const connection = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = connection;

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                connection.addTrack(track, streamRef.current!);
            });
        }

        connection.ontrack = (event) => {
            const incomingStream = event.streams[0] || new MediaStream([event.track]);
            remoteStreamRef.current = incomingStream;
            setRemoteStream(incomingStream);
            setCallState("connected");
            setConnectionStatus("Connected to opponent.");

            // Signal to backend that video is visible
            if (socketRef.current && roomIdRef.current) {
                socketRef.current.emit("client_ready", { roomId: roomIdRef.current });
            }
        };

        connection.onconnectionstatechange = () => {
            if (connection.connectionState === "failed") {
                setConnectionStatus("WebRTC connection failed.");
            }
        };

        connection.onicecandidate = (event) => {
            if (event.candidate && roomIdRef.current && socketRef.current) {
                socketRef.current.emit("webrtc_ice_candidate", {
                    roomId: roomIdRef.current,
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        return connection;
    }, []);

    // 1. Initialize Camera & Mic first. NOTHING starts before mic and camera are active!
    const initLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
        setMediaError(null);
        setConnectionStatus("Accessing camera & microphone...");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            streamRef.current = stream;
            setHasMediaPermissions(true);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            return stream;
        } catch (error) {
            console.error("Failed to acquire camera/mic stream:", error);
            setHasMediaPermissions(false);
            setMediaError(
                "Camera and microphone are required before starting video chat. Please allow permissions."
            );
            setConnectionStatus("Camera and microphone permission required.");
            return null;
        }
    }, []);

    // 2. Start Matchmaking lifecycle (only when media is active)
    useEffect(() => {
        let isCancelled = false;

        const startSessionAndSockets = async () => {
            // First: acquire camera & mic
            const stream = await initLocalMedia();
            if (isCancelled || !stream) {
                // If camera and mic are not given, NOTHING STARTS!
                return;
            }

            // Ensure player session is ready
            try {
                const sessionRes = await getSessionDetails();
                if (sessionRes?.profile) {
                    setUserData(sessionRes.profile);
                }
            } catch {
                const initRes = await initPlayer(nickname);
                if (initRes?.profile) {
                    setUserData(initRes.profile);
                }
            }
            // Connect Socket.IO
            const token =
                sessionStorage.getItem("jwtToken") || localStorage.getItem("jwtToken");

            const socket = io(import.meta.env.VITE_BACKEND_URL, {
                withCredentials: true,
                auth: {
                    token: token || undefined,
                },
            });
            socketRef.current = socket;

            socket.on("connect", () => {
                setCallState("searching");
                setConnectionStatus("Looking for an opponent...");
                socket.emit("find_match");
            });

            socket.on("connect_error", (err) => {
                console.error(`Socket connection failed: ${err.message}`);
                setConnectionStatus("Unable to connect to the matchmaking server.");
            });

            socket.on("waiting_for_opponent", () => {
                setCallState("searching");
                setConnectionStatus("Looking for an opponent...");
            });

            socket.on(
                "match_found",
                async ({
                    roomId,
                    initiator,
                    opponentNickname: matchedOpponentNickname,
                }: {
                    roomId: string;
                    initiator: boolean;
                    opponentNickname?: string;
                }) => {
                    roomIdRef.current = roomId;
                    setOpponentNickname(matchedOpponentNickname || "Stranger");
                    setConnectionStatus("Connecting to opponent...");

                    const connection = setupPeerConnection();
                    if (!initiator) return;

                    try {
                        const offer = await connection.createOffer();
                        await connection.setLocalDescription(offer);
                        socket.emit("webrtc_offer", {
                            roomId,
                            sdp: connection.localDescription,
                        });
                    } catch (error) {
                        console.error("Failed to create WebRTC offer:", error);
                        setConnectionStatus("Unable to create video offer.");
                    }
                }
            );

            socket.on(
                "webrtc_offer",
                async ({ roomId, sdp }: { roomId: string; sdp: RTCSessionDescriptionInit }) => {
                    roomIdRef.current = roomId;
                    const connection = setupPeerConnection();
                    try {
                        await connection.setRemoteDescription(sdp);
                        for (const candidate of pendingCandidatesRef.current) {
                            await connection.addIceCandidate(candidate);
                        }
                        pendingCandidatesRef.current = [];
                        const answer = await connection.createAnswer();
                        await connection.setLocalDescription(answer);
                        socket.emit("webrtc_answer", {
                            roomId,
                            sdp: connection.localDescription,
                        });
                    } catch (error) {
                        console.error("Failed to handle WebRTC offer:", error);
                        setConnectionStatus("Unable to accept video offer.");
                    }
                }
            );

            socket.on(
                "webrtc_answer",
                async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
                    if (!peerConnectionRef.current) return;
                    try {
                        await peerConnectionRef.current.setRemoteDescription(sdp);
                        for (const candidate of pendingCandidatesRef.current) {
                            await peerConnectionRef.current.addIceCandidate(candidate);
                        }
                        pendingCandidatesRef.current = [];
                    } catch (error) {
                        console.error("Failed to handle WebRTC answer:", error);
                        setConnectionStatus("Unable to complete video connection.");
                    }
                }
            );

            socket.on(
                "webrtc_ice_candidate",
                async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
                    if (!peerConnectionRef.current?.remoteDescription) {
                        pendingCandidatesRef.current.push(candidate);
                        return;
                    }
                    try {
                        await peerConnectionRef.current.addIceCandidate(candidate);
                    } catch (error) {
                        console.error("Failed to add ICE candidate:", error);
                    }
                }
            );

            socket.on("opponent_disconnected", () => {
                teardownPeerConnection();
                roomIdRef.current = null;
                setCallState("stopped");
                setCaptureError(null);
                setIsBlindPhase(false);
                setLastRoundResult(null);
                setConnectionStatus("Opponent disconnected. Find a new partner when ready.");
            });

            socket.on("warmup_start", (data: { durationSeconds: number; message?: string }) => {
                setGamePhase("warmup");
                setTimer(data.durationSeconds || 10);
                setRound(0);
                setIsBlindPhase(false);
                setScores({ user: 0, opponent: 0 });
                setMatchWinner(null);
                setLastRoundResult(null);
                setCaptureError(null);
                setConnectionStatus(data.message || "Game starts in 10s... Say hello!");
            });

            socket.on("round_start", (data: { round: number; durationMs?: number; blindAfterMs?: number }) => {
                setGamePhase("action");
                setIsBlindPhase(false);
                setRound(Math.min(data.round, 5));
                setTimer(Math.round((data.durationMs || 5000) / 1000));
                setCaptureError(null);
                setConnectionStatus(`Round ${Math.min(data.round, 5)} of 5: Show your hand!`);
            });

            socket.on("round_blind_phase", () => {
                // Server-side coordinated blind phase at 3.5s
                setIsBlindPhase(true);
            });

            socket.on("roundResults", (data: {
                round?: number;
                maxRounds?: number;
                p1_move: string;
                p2_move: string;
                winner?: string;
                result: string;
                reason?: string;
                p1_score?: number;
                p2_score?: number;
                p1_id?: string;
                p2_id?: string;
                nextRoundIn?: number;
                isFinalRound?: boolean;
            }) => {
                setCaptureError(null);
                // Return camera to normal where both players can see each other
                setIsBlindPhase(false);

                const isPlayer1 = socket.id === data.p1_id;
                const myScore = isPlayer1 ? (data.p1_score ?? 0) : (data.p2_score ?? 0);
                const oppScore = isPlayer1 ? (data.p2_score ?? 0) : (data.p1_score ?? 0);
                setScores({ user: myScore, opponent: oppScore });

                const myMove = isPlayer1 ? data.p1_move : data.p2_move;
                const oppMove = isPlayer1 ? data.p2_move : data.p1_move;
                let roundWinner: "user" | "opponent" | "draw" = "draw";
                if (data.winner === "player_1") {
                    roundWinner = isPlayer1 ? "user" : "opponent";
                } else if (data.winner === "player_2") {
                    roundWinner = !isPlayer1 ? "user" : "opponent";
                }

                setLastRoundResult({
                    winner: roundWinner,
                    userMove: myMove || "none",
                    opponentMove: oppMove || "none",
                    reason: data.reason || data.result,
                    round: Math.min(data.round ?? round, 5),
                });

                let outcome = data.reason || data.result;
                if (roundWinner === "user") {
                    outcome = `🎉 You won! (${data.reason || "Round Won"})`;
                } else if (roundWinner === "opponent") {
                    outcome = `💀 Opponent won! (${data.reason || "Round Lost"})`;
                } else {
                    outcome = `🤝 Draw! (${data.reason || "Tie"})`;
                }

                setGamePhase("round_break");
                setTimer(data.nextRoundIn ?? 5);
                setConnectionStatus(outcome);
            });

            socket.on("match_finished", (data: {
                winner: string;
                p1_score: number;
                p2_score: number;
                totalRounds?: number;
            }) => {
                setIsBlindPhase(false);
                setGamePhase("game_over");
                setMatchWinner(data.winner);
                setConnectionStatus("Match Finished!");
            });
        };

        void startSessionAndSockets();

        return () => {
            isCancelled = true;
            streamRef.current?.getTracks().forEach((track) => track.stop());
            teardownPeerConnection();
            socketRef.current?.disconnect();
        };
    }, [nickname, initLocalMedia, setupPeerConnection, teardownPeerConnection]);

    // Action: Next Partner
    // Cuts the current call, immediately returns back to original proportions, and searches for a new partner
    const handleNext = () => {
        teardownPeerConnection();
        roomIdRef.current = null;
        setCallState("searching");
        setCaptureError(null);
        setConnectionStatus("Looking for an opponent...");

        if (socketRef.current) {
            socketRef.current.emit("leave_room");
            socketRef.current.emit("find_match");
        }
    };

    // Action: Stop Calling / Matching
    const handleStop = () => {
        teardownPeerConnection();
        roomIdRef.current = null;
        setCallState("stopped");
        setCaptureError(null);
        setConnectionStatus("Matchmaking stopped.");

        if (socketRef.current) {
            socketRef.current.emit("leave_room");
        }
    };

    // Action: Start Searching (after stopped)
    const handleStartSearching = () => {
        setCallState("searching");
        setCaptureError(null);
        setConnectionStatus("Looking for an opponent...");
        if (socketRef.current) {
            socketRef.current.emit("find_match");
        }
    };

    // Action: Leave Room completely
    const handleLeaveRoom = () => {
        teardownPeerConnection();
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        navigate("/");
    };

    const isConnected = callState === "connected" && remoteStream !== null;

    return (
        <main className="room-page">
            {/* Header */}
            <header className="room-header">
                <div className="room-title-group">
                    <p className="eyebrow">CHEIRON / VIDEO CHAT</p>
                    <h1 className="room-heading">
                        {isConnected ? "In Call" : "Video Room"}
                    </h1>
                </div>

                <div className="room-header-actions">
                    <button
                        type="button"
                        className="profile-top-button in-room-profile-btn"
                        onClick={() => setIsProfileOpen(true)}
                        title="View Profile"
                        aria-label="Open user profile"
                    >
                        <span className="profile-status-dot active" />
                        <span className="profile-top-nickname">{nickname}</span>
                        <svg
                            className="profile-icon"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                        >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </button>

                    <button
                        type="button"
                        className="text-button leave-button"
                        onClick={handleLeaveRoom}
                    >
                        Leave room
                    </button>
                </div>
            </header>

            {/* If camera & mic are not granted, block everything and show prompt */}
            {hasMediaPermissions === false && (
                <div className="permission-barrier-card" role="alert">
                    <div className="barrier-icon">⚠️</div>
                    <h2>Camera and Microphone Required</h2>
                    <p>
                        Nothing can start until camera and microphone permissions are granted.
                        Please allow access in your browser to begin matching.
                    </p>
                    <button
                        type="button"
                        onClick={initLocalMedia}
                        className="primary-button"
                    >
                        Grant Camera & Mic Access
                    </button>
                </div>
            )}

            {/* Top Game State Notification / Banner */}
            {isConnected && gamePhase === "warmup" && (
                <div className="game-status-banner warmup-banner" role="status">
                    <span className="banner-icon">👋</span>
                    <span className="banner-text">
                        Connected! Game starts in <strong>{timer}s</strong>... Say hello & get ready!
                    </span>
                </div>
            )}

            {isConnected && gamePhase === "action" && (
                <div className="game-status-banner action-banner" role="status">
                    <span className="banner-round-tag">Round {Math.min(round, 5)} / 5</span>
                    <span className="banner-scoreboard">
                        {nickname}: <strong>{scores.user}</strong> &nbsp;|&nbsp; {opponentNickname || "Stranger"}: <strong>{scores.opponent}</strong>
                    </span>
                    <span className="banner-timer-tag">⏳ {timer}s</span>
                </div>
            )}

            {isConnected && gamePhase === "round_break" && (
                <div
                    className={`game-status-banner break-banner ${
                        lastRoundResult?.winner === "user"
                            ? "winner-banner"
                            : lastRoundResult?.winner === "opponent"
                            ? "loser-banner"
                            : "draw-banner"
                    }`}
                    role="status"
                >
                    <span className="banner-icon">
                        {lastRoundResult?.winner === "user" ? "🎉" : lastRoundResult?.winner === "opponent" ? "💀" : "🤝"}
                    </span>
                    <span className="banner-text">
                        {lastRoundResult?.winner === "user" ? (
                            <>
                                <strong>YOU WON ROUND {lastRoundResult.round}!</strong> &nbsp;•&nbsp; Next round in <strong>{timer}s</strong>...
                            </>
                        ) : lastRoundResult?.winner === "opponent" ? (
                            <>
                                <strong>YOU LOST ROUND {lastRoundResult.round}</strong> &nbsp;•&nbsp; Next round in <strong>{timer}s</strong>...
                            </>
                        ) : (
                            <>
                                <strong>ROUND {lastRoundResult?.round || round} TIED!</strong> &nbsp;•&nbsp; Next round in <strong>{timer}s</strong>...
                            </>
                        )}
                    </span>
                    <span className="banner-scoreboard-mini">
                        ({scores.user} - {scores.opponent})
                    </span>
                </div>
            )}

            {isConnected && gamePhase === "game_over" && (
                <div className="game-status-banner gameover-banner" role="status">
                    <span className="banner-icon">
                        {matchWinner === "draw" ? "🤝" : "🏆"}
                    </span>
                    <span className="banner-text">
                        <strong>Match Finished!</strong> Final Score: {scores.user} - {scores.opponent} {matchWinner === "draw" ? "(Draw!)" : ""}
                    </span>
                </div>
            )}

            {/* Break Celebration / Defeat Card Overlay */}
            {isConnected && gamePhase === "round_break" && lastRoundResult && (
                <div className={`round-break-celebration-container ${lastRoundResult.winner}`}>
                    <div className="celebration-card-inner">
                        {lastRoundResult.winner === "user" ? (
                            <>
                                <div className="celebration-particles" aria-hidden="true">
                                    <span>🎉</span> <span>🏆</span> <span>✨</span>
                                </div>
                                <span className="celebration-badge-pill">ROUND {lastRoundResult.round} WIN</span>
                                <h2 className="celebration-heading">🎉 You Won This Round! 🎉</h2>
                                <p className="celebration-matchup">
                                    <span className="move-tag win-move">You: {lastRoundResult.userMove.toUpperCase()}</span>
                                    <span className="vs-tag">vs</span>
                                    <span className="move-tag loss-move">{opponentNickname || "Opponent"}: {lastRoundResult.opponentMove.toUpperCase()}</span>
                                </p>
                                <p className="celebration-reason">{lastRoundResult.reason}</p>
                                <div className="celebration-timer-box">
                                    Next round in <strong>{timer}s</strong>...
                                </div>
                            </>
                        ) : lastRoundResult.winner === "opponent" ? (
                            <>
                                <div className="defeat-particles" aria-hidden="true">
                                    <span>💀</span> <span>💔</span> <span>⚠️</span>
                                </div>
                                <span className="defeat-badge-pill">ROUND {lastRoundResult.round} DEFEAT</span>
                                <h2 className="defeat-heading">You Lost This Round</h2>
                                <p className="celebration-matchup">
                                    <span className="move-tag loss-move">You: {lastRoundResult.userMove.toUpperCase()}</span>
                                    <span className="vs-tag">vs</span>
                                    <span className="move-tag win-move">{opponentNickname || "Opponent"}: {lastRoundResult.opponentMove.toUpperCase()}</span>
                                </p>
                                <p className="defeat-reason">{lastRoundResult.reason}</p>
                                <div className="defeat-timer-box">
                                    Next round in <strong>{timer}s</strong>...
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="draw-badge-pill">ROUND {lastRoundResult.round} TIE</span>
                                <h2 className="draw-heading">🤝 Round Tied!</h2>
                                <p className="celebration-matchup">
                                    <span className="move-tag draw-move">Both chose: {lastRoundResult.userMove.toUpperCase()}</span>
                                </p>
                                <p className="draw-reason">{lastRoundResult.reason}</p>
                                <div className="draw-timer-box">
                                    Next round in <strong>{timer}s</strong>...
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Video Stage: 50-50 Split Layout (Left: Opponent, Right: You) */}
            <section
                className="video-stage"
                aria-label="Video Call Stage"
            >
                {/* Left Panel (50%): Remote Participant / Opponent */}
                <article className="panel-remote">
                    <div className="panel-header-overlay">
                        <div className="participant-badge">
                            <span className={`status-indicator-dot ${isConnected ? "connected" : "pulsing"}`} />
                            <span className="participant-label">
                                {isConnected ? opponentNickname || "Stranger" : "Stranger"}
                            </span>
                        </div>
                        {isConnected && (
                            <div className="call-duration-badge">
                                ⏱️ {formatDuration(callDuration)}
                            </div>
                        )}
                    </div>

                    <div className={`video-viewport remote-viewport ${isBlindPhase ? "blind-active" : ""}`}>
                        {remoteStream ? (
                            <>
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className={`stream-video remote-video ${isBlindPhase ? "blind-blackout" : ""}`}
                                />
                                {isBlindPhase && (
                                    <div className="blind-conceal-overlay" aria-live="assertive">
                                        <div className="blind-lock-symbol">🔒</div>
                                        <p className="blind-lock-title">Vision Obscured</p>
                                        <p className="blind-lock-subtitle">Anti-peeking mode: Lock in your move!</p>
                                    </div>
                                )}
                                {gamePhase === "action" && (
                                    <div className="game-timer-overlay" aria-live="polite">
                                        {timer}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="searching-placeholder">
                                {callState === "searching" && (
                                    <div className="radar-spinner" aria-hidden="true">
                                        <div className="radar-circle circle-1" />
                                        <div className="radar-circle circle-2" />
                                        <div className="radar-circle circle-3" />
                                    </div>
                                )}
                                <p className="connection-status-text">{connectionStatus}</p>
                                {callState === "stopped" && (
                                    <button
                                        type="button"
                                        onClick={handleStartSearching}
                                        className="primary-button resume-button"
                                    >
                                        Find Partner
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </article>

                {/* Right Panel (50%): Local Participant / You */}
                <article className="panel-local">
                    <div className="panel-header-overlay local-overlay">
                        <div className="participant-badge local-badge">
                            <span className="status-indicator-dot local-dot" />
                            <span className="participant-label">{nickname} (You)</span>
                        </div>
                    </div>

                    <div className={`video-viewport local-viewport ${gamePhase === "round_break" ? "break-dimmed" : ""}`}>
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`stream-video local-video active ${gamePhase === "round_break" ? "camera-dimmed" : ""}`}
                            aria-label="Your local camera stream"
                        />
                        {gamePhase === "round_break" && (
                            <div className="camera-dimmed-tag" aria-hidden="true">
                                <span>🌙 Camera Dimmed (Break)</span>
                            </div>
                        )}
                        <canvas
                            ref={canvasRef}
                            className="hand-tracking-canvas"
                            aria-hidden="true"
                        />
                        {isCapturing && (
                            <div className="game-timer-overlay" aria-live="polite">
                                {captureSampleCount > 0 ? `Captured (${captureSampleCount})` : "Show hand"}
                            </div>
                        )}
                        {captureError && (
                            <div className="side-notification-popup" role="alert">
                                <svg
                                    className="side-notification-icon"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span className="side-notification-text">{captureError}</span>
                            </div>
                        )}
                    </div>
                </article>
            </section>

            {/* Bottom Controls Bar (Stop / Next) */}
            <footer className="original-controls-bar">
                <div className="controls-group-center">
                    {callState === "stopped" ? (
                        <button
                            type="button"
                            onClick={handleStartSearching}
                            className="control-action-btn btn-start-search"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            Find Partner
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleStop}
                            className="control-action-btn btn-stop-search"
                            title={isConnected ? "End Call / Stop" : "Stop Searching"}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <rect width="14" height="14" x="5" y="5" rx="2" />
                            </svg>
                            Stop
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleNext}
                        className="control-action-btn btn-skip-next"
                        title="Skip to Next Partner"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 4 15 12 5 20 5 4" />
                            <line x1="19" x2="19" y1="5" y2="19" stroke="currentColor" strokeWidth="3" />
                        </svg>
                        Next
                    </button>
                </div>
            </footer>

            {mediaError && (
                <p className="media-error" role="alert">
                    {mediaError}
                </p>
            )}

            {/* Profile Modal */}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onDeleted={handleLeaveRoom}
            />
        </main>
    );
}
