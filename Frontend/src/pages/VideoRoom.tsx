import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { io, type Socket } from "socket.io-client";
import {
    AlertTriangle,
    Hand,
    Hourglass,
    Trophy,
    Skull,
    Handshake,
    PartyPopper,
    Sparkles,
    HeartCrack,
    Timer,
    Lock,
    Moon,
    Play,
    Square,
    SkipForward,
} from "lucide-react";
import { useNickname } from "../context/NicknameContext";
import { initPlayer, getSessionDetails } from "../service/service";
import { ProfileModal } from "../components/ProfileModal";

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.services.mozilla.com" },
    ],
    iceCandidatePoolSize: 10,
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
const BLACKOUT_DURATION_SECONDS = 5;

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
    const gamePhaseRef = useRef<"waiting" | "warmup" | "countdown" | "blackout" | "reveal" | "round_break" | "game_over">("waiting");
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const detectionFrameRef = useRef<number | null>(null);
    const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const captureSamplesRef = useRef<number[][]>([]);
    const evaluationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        "waiting" | "warmup" | "countdown" | "blackout" | "reveal" | "round_break" | "game_over"
    >("waiting");
    const [timer, setTimer] = useState(0);
    const [round, setRound] = useState(0);
    const [scores, setScores] = useState({ user: 0, opponent: 0 });
    const [matchWinner, setMatchWinner] = useState<string | null>(null);
    const [lastRoundResult, setLastRoundResult] = useState<{
        winner: "user" | "opponent" | "draw";
        userMove: string;
        opponentMove: string;
        reason: string;
        round: number;
    } | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);

    useEffect(() => {
        gamePhaseRef.current = gamePhase;
        if (gamePhase !== "blackout") {
            latestCoordinatesRef.current = null;
        }
    }, [gamePhase]);

    useEffect(() => {
        if (!hasMediaPermissions || !streamRef.current) return;

        let cancelled = false;
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

                    if (gamePhaseRef.current === "blackout") {
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

    // Keep the visible timer synchronized for each timed game phase.
    useEffect(() => {
        if (
            gamePhase !== "warmup" &&
            gamePhase !== "countdown" &&
            gamePhase !== "blackout" &&
            gamePhase !== "round_break"
        ) return;

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

    // Enter the exact five-second blackout window after the ready countdown.
    useEffect(() => {
        if (gamePhase !== "countdown" || timer !== 0) return;

        const transitionTimeout = setTimeout(() => {
            setGamePhase("blackout");
            setTimer(BLACKOUT_DURATION_SECONDS);
        }, 0);

        if (!socketRef.current || !roomIdRef.current) {
            setCaptureError("Unable to submit hand coordinates.");
        }

        return () => clearTimeout(transitionTimeout);
    }, [gamePhase, timer]);

    useEffect(() => {
        if (gamePhase !== "blackout") return;

        captureSamplesRef.current = [];

        const submitCapturedCoordinates = () => {
            if (captureIntervalRef.current !== null) {
                clearInterval(captureIntervalRef.current);
                captureIntervalRef.current = null;
            }
            if (captureTimeoutRef.current !== null) {
                clearTimeout(captureTimeoutRef.current);
                captureTimeoutRef.current = null;
            }

            const coordinates = captureSamplesRef.current;
            if (coordinates.length === 0) {
                setCaptureError("No hand detected during the blackout.");
            }

            socketRef.current?.emit("submit_coordinates", {
                roomId: roomIdRef.current,
                coordinates,
            });
            setGamePhase("reveal");
            setTimer(0);
        };

        const captureFrame = () => {
            const coordinates = latestCoordinatesRef.current;
            if (coordinates && coordinates.length === LANDMARK_VALUE_COUNT) {
                captureSamplesRef.current.push([...coordinates]);
            }
        };

        captureIntervalRef.current = setInterval(captureFrame, 200);
        captureTimeoutRef.current = setTimeout(
            submitCapturedCoordinates,
            BLACKOUT_DURATION_SECONDS * 1000
        );

        return () => {
            if (captureIntervalRef.current !== null) {
                clearInterval(captureIntervalRef.current);
                captureIntervalRef.current = null;
            }
            if (captureTimeoutRef.current !== null) {
                clearTimeout(captureTimeoutRef.current);
                captureTimeoutRef.current = null;
            }
        };
    }, [gamePhase]);

    // Safe helper to play remote video with autoplay policy fallback
    const playRemoteVideo = useCallback((videoEl: HTMLVideoElement) => {
        videoEl.play().catch(() => {
            // Autoplay policy prevented playback with audio; mute and retry immediately
            videoEl.muted = true;
            setIsRemoteAudioMuted(true);
            void videoEl.play().catch(() => {
                setConnectionStatus("Click video to enable playback.");
            });
        });
    }, []);

    const handleUnmuteRemote = useCallback(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.muted = false;
            void remoteVideoRef.current.play().catch(() => undefined);
            setIsRemoteAudioMuted(false);
        }
    }, []);

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
            void videoRef.current.play().catch(() => {
                setConnectionStatus("Click the page to allow local video playback.");
            });
        }
    }, [hasMediaPermissions]);

    // Attach remote stream to remote video element
    useEffect(() => {
        if (remoteVideoRef.current) {
            if (remoteStream && remoteVideoRef.current.srcObject !== remoteStream) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            if (remoteStream) {
                playRemoteVideo(remoteVideoRef.current);
            }
        }
    }, [remoteStream, playRemoteVideo]);

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
        if (evaluationTimeoutRef.current !== null) {
            clearTimeout(evaluationTimeoutRef.current);
            evaluationTimeoutRef.current = null;
        }
        if (captureIntervalRef.current !== null) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }
        if (captureTimeoutRef.current !== null) {
            clearTimeout(captureTimeoutRef.current);
            captureTimeoutRef.current = null;
        }
        remoteStreamRef.current = null;
        setRemoteStream(null);
        setOpponentNickname(null);
        setCallDuration(0);
        setIsRemoteAudioMuted(false);
        setGamePhase("waiting");
        setTimer(0);
        setRound(0);
        setScores({ user: 0, opponent: 0 });
        setMatchWinner(null);
        setLastRoundResult(null);
    }, []);

    // Setup WebRTC PeerConnection
    const setupPeerConnection = useCallback(() => {
        let connection = peerConnectionRef.current;
        if (!connection) {
            connection = new RTCPeerConnection(ICE_SERVERS);
            peerConnectionRef.current = connection;
        }

        // Ensure all local tracks are added to the peer connection
        if (streamRef.current) {
            const senders = connection.getSenders();
            streamRef.current.getTracks().forEach((track) => {
                const alreadyAdded = senders.some((s) => s.track?.id === track.id);
                if (!alreadyAdded) {
                    connection.addTrack(track, streamRef.current!);
                }
            });
        }

        connection.ontrack = (event) => {
            const incomingTrack = event.track;
            const eventStream = event.streams[0];
            let currentStream = remoteStreamRef.current;
            if (!currentStream) {
                currentStream = eventStream
                    ? new MediaStream(eventStream.getTracks())
                    : new MediaStream();
                remoteStreamRef.current = currentStream;
            }

            if (!currentStream.getTracks().some((t) => t.id === incomingTrack.id)) {
                currentStream.addTrack(incomingTrack);
            }

            if (eventStream) {
                eventStream.getTracks().forEach((track) => {
                    if (!currentStream!.getTracks().some((t) => t.id === track.id)) {
                        currentStream!.addTrack(track);
                    }
                });
            }

            // Bind unmute event to trigger play once frames/audio are actively arriving
            incomingTrack.onunmute = () => {
                if (remoteVideoRef.current && remoteStreamRef.current) {
                    if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
                        remoteVideoRef.current.srcObject = remoteStreamRef.current;
                    }
                    playRemoteVideo(remoteVideoRef.current);
                }
            };

            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = currentStream;
                playRemoteVideo(remoteVideoRef.current);
            }

            // CRITICAL: Clone into a new MediaStream instance so React state reference changes
            // and triggers re-renders on subsequent tracks (e.g. video after audio)
            setRemoteStream(new MediaStream(currentStream.getTracks()));
            setCallState("connected");
            setConnectionStatus("Connected to opponent.");

            // Signal to backend that video is visible
            if (socketRef.current && roomIdRef.current) {
                socketRef.current.emit("client_ready", { roomId: roomIdRef.current });
            }
        };

        connection.onconnectionstatechange = () => {
            if (connection.connectionState === "connected") {
                setConnectionStatus("Connected to opponent.");
                setCallState("connected");
            } else if (connection.connectionState === "disconnected") {
                setConnectionStatus("Opponent connection interrupted. Reconnecting...");
            } else if (connection.connectionState === "failed") {
                setConnectionStatus("WebRTC connection failed. Retrying...");
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
    }, [playRemoteVideo]);

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

            const drainPendingCandidates = async (connection: RTCPeerConnection) => {
                const candidates = [...pendingCandidatesRef.current];
                pendingCandidatesRef.current = [];
                for (const candidate of candidates) {
                    if (!candidate || (!candidate.candidate && candidate.candidate !== "")) {
                        continue;
                    }
                    try {
                        await connection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (error) {
                        console.error("Failed to add buffered ICE candidate:", error);
                    }
                }
            };

            socket.on(
                "webrtc_offer",
                async ({ roomId, sdp }: { roomId: string; sdp: RTCSessionDescriptionInit }) => {
                    roomIdRef.current = roomId;
                    const connection = setupPeerConnection();
                    try {
                        await connection.setRemoteDescription(new RTCSessionDescription(sdp));
                        await drainPendingCandidates(connection);
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
                    const connection = peerConnectionRef.current;
                    if (!connection) return;
                    try {
                        await connection.setRemoteDescription(new RTCSessionDescription(sdp));
                        await drainPendingCandidates(connection);
                    } catch (error) {
                        console.error("Failed to handle WebRTC answer:", error);
                        setConnectionStatus("Unable to complete video connection.");
                    }
                }
            );

            socket.on(
                "webrtc_ice_candidate",
                async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
                    if (!candidate || (!candidate.candidate && candidate.candidate !== "")) {
                        return;
                    }
                    const connection = peerConnectionRef.current;
                    if (!connection?.remoteDescription) {
                        pendingCandidatesRef.current.push(candidate);
                        return;
                    }
                    try {
                        await connection.addIceCandidate(new RTCIceCandidate(candidate));
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
                setLastRoundResult(null);
                setConnectionStatus("Opponent disconnected. Find a new partner when ready.");
            });

            socket.on("warmup_start", (data: { durationSeconds: number; message?: string }) => {
                setGamePhase("warmup");
                setTimer(data.durationSeconds || 10);
                setRound(0);
                setScores({ user: 0, opponent: 0 });
                setMatchWinner(null);
                setLastRoundResult(null);
                setCaptureError(null);
                setConnectionStatus(data.message || "Game starts in 10s... Say hello!");
            });

            socket.on("round_start", (data: { round: number; durationMs?: number; blindAfterMs?: number }) => {
                if (evaluationTimeoutRef.current !== null) {
                    clearTimeout(evaluationTimeoutRef.current);
                    evaluationTimeoutRef.current = null;
                }
                setGamePhase("countdown");
                const nextRound = Math.min(data.round, 5);
                setRound(nextRound);
                setTimer(5);
                setCaptureError(null);
                setConnectionStatus(`Round ${Math.min(data.round, 5)} of 5: Position your hand!`);
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
                setGamePhase("reveal");

                const isPlayer1 = data.p1_id ? socket.id === data.p1_id : true;
                if (
                    typeof data.p1_score === "number" &&
                    typeof data.p2_score === "number"
                ) {
                    setScores({
                        user: isPlayer1 ? data.p1_score : data.p2_score,
                        opponent: isPlayer1 ? data.p2_score : data.p1_score,
                    });
                }

                const myMove = isPlayer1 ? data.p1_move : data.p2_move;
                const oppMove = isPlayer1 ? data.p2_move : data.p1_move;
                let roundWinner: "user" | "opponent" | "draw" = "draw";
                const normalizedMyMove = (myMove || "none").toLowerCase().trim();
                const normalizedOppMove = (oppMove || "none").toLowerCase().trim();
                const userWon =
                    (normalizedMyMove === "rock" && normalizedOppMove === "scissors") ||
                    (normalizedMyMove === "paper" && normalizedOppMove === "rock") ||
                    (normalizedMyMove === "scissors" && normalizedOppMove === "paper");
                if (normalizedOppMove === "none" && normalizedMyMove !== "none") {
                    roundWinner = "user";
                } else if (normalizedMyMove === "none" && normalizedOppMove !== "none") {
                    roundWinner = "opponent";
                } else if (normalizedMyMove !== normalizedOppMove) {
                    roundWinner = userWon ? "user" : "opponent";
                }
                if (data.winner === "draw") roundWinner = "draw";

                setLastRoundResult({
                    winner: roundWinner,
                    userMove: myMove || "none",
                    opponentMove: oppMove || "none",
                    reason: data.reason || data.result,
                    round: Math.min(data.round ?? round, 5),
                });

                let outcome = data.reason || data.result;
                if (roundWinner === "user") {
                    outcome = `You won! (${data.reason || "Round Won"})`;
                } else if (roundWinner === "opponent") {
                    outcome = `Opponent won! (${data.reason || "Round Lost"})`;
                } else {
                    outcome = `Draw! (${data.reason || "Tie"})`;
                }

                setTimer(1);
                setConnectionStatus("Evaluating round...");

                evaluationTimeoutRef.current = window.setTimeout(() => {
                    evaluationTimeoutRef.current = null;
                    setGamePhase("round_break");
                    setTimer(data.nextRoundIn ?? 5);
                    setConnectionStatus(outcome);
                }, 1000);
            });

            socket.on("round_error", ({ message }: { message: string }) => {
                console.error("Round error:", message);
                setCaptureError(message || "The round could not be evaluated.");
                setGamePhase("round_break");
                setTimer(0);
                setConnectionStatus(message || "The round could not be evaluated.");
            });

            socket.on("match_finished", (data: {
                winner: string;
                p1_score: number;
                p2_score: number;
                p1_id?: string;
                p2_id?: string;
                totalRounds?: number;
            }) => {
                if (evaluationTimeoutRef.current !== null) {
                    clearTimeout(evaluationTimeoutRef.current);
                    evaluationTimeoutRef.current = null;
                }
                setGamePhase("game_over");
                if (data.p1_id && data.p2_id) {
                    setScores({
                        user: socket.id === data.p1_id ? data.p1_score : data.p2_score,
                        opponent: socket.id === data.p1_id ? data.p2_score : data.p1_score,
                    });
                }
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
                    <div className="barrier-icon">
                        <AlertTriangle size={36} color="#f59e0b" />
                    </div>
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
                    <span className="banner-icon">
                        <Hand size={18} />
                    </span>
                    <span className="banner-text">
                        Connected! Game starts in <strong>{timer}s</strong>... Say hello & get ready!
                    </span>
                </div>
            )}

            {isConnected && gamePhase === "countdown" && (
                <div className="game-status-banner action-banner" role="status">
                    <span className="banner-round-tag">Round {Math.min(round, 5)} / 5</span>
                    <span className="banner-scoreboard">
                        {nickname}: <strong>{scores.user}</strong> &nbsp;|&nbsp; {opponentNickname || "Stranger"}: <strong>{scores.opponent}</strong>
                    </span>
                    <span className="banner-timer-tag">
                        <Hourglass size={13} /> {timer}s
                    </span>
                </div>
            )}

            {isConnected && (gamePhase === "reveal" || gamePhase === "round_break") && (
                <div
                    className={`game-status-banner break-banner ${
                        gamePhase === "reveal"
                            ? "evaluation-banner"
                            :
                        lastRoundResult?.winner === "user"
                            ? "winner-banner"
                            : lastRoundResult?.winner === "opponent"
                            ? "loser-banner"
                            : "draw-banner"
                    }`}
                    role="status"
                >
                    <span className="banner-icon">
                        {gamePhase === "reveal" ? (
                            <Hourglass size={18} />
                        ) : lastRoundResult?.winner === "user" ? (
                            <Trophy size={18} />
                        ) : lastRoundResult?.winner === "opponent" ? (
                            <Skull size={18} />
                        ) : (
                            <Handshake size={18} />
                        )}
                    </span>
                    <span className="banner-text">
                        {gamePhase === "reveal" ? (
                            <>
                                <strong>Revealing round {lastRoundResult?.round || round}...</strong>
                            </>
                        ) : lastRoundResult?.winner === "user" ? (
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
                    {gamePhase === "round_break" && (
                        <span className="banner-scoreboard-mini">
                            ({scores.user} - {scores.opponent})
                        </span>
                    )}
                </div>
            )}

            {isConnected && gamePhase === "game_over" && (
                <div className="game-status-banner gameover-banner" role="status">
                    <span className="banner-icon">
                        {matchWinner === "draw" ? <Handshake size={18} /> : <Trophy size={18} />}
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
                                    <PartyPopper size={22} />
                                    <Trophy size={22} />
                                    <Sparkles size={22} />
                                </div>
                                <span className="celebration-badge-pill">ROUND {lastRoundResult.round} WIN</span>
                                <h2 className="celebration-heading">
                                    <Trophy size={24} /> You Won This Round!
                                </h2>
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
                                    <Skull size={22} />
                                    <HeartCrack size={22} />
                                    <AlertTriangle size={22} />
                                </div>
                                <span className="defeat-badge-pill">ROUND {lastRoundResult.round} DEFEAT</span>
                                <h2 className="defeat-heading">
                                    <Skull size={24} /> You Lost This Round
                                </h2>
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
                                <h2 className="draw-heading">
                                    <Handshake size={24} /> Round Tied!
                                </h2>
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
                                <Timer size={14} /> {formatDuration(callDuration)}
                            </div>
                        )}
                    </div>

                    <div className={`video-viewport remote-viewport ${gamePhase === "blackout" ? "blind-active" : ""} ${
                        gamePhase === "round_break" && lastRoundResult?.winner === "user"
                            ? "result-loser"
                            : ""
                    }`}>
                        <>
                            <video
                                ref={(element) => {
                                    remoteVideoRef.current = element;
                                    if (
                                        element &&
                                        remoteStreamRef.current &&
                                        element.srcObject !== remoteStreamRef.current
                                    ) {
                                        element.srcObject = remoteStreamRef.current;
                                        playRemoteVideo(element);
                                    }
                                }}
                                autoPlay
                                playsInline
                                className="stream-video remote-video"
                                style={remoteStream ? undefined : { display: "none" }}
                            />
                            {isRemoteAudioMuted && isConnected && (
                                <button
                                    type="button"
                                    onClick={handleUnmuteRemote}
                                    className="unmute-banner-btn"
                                    title="Click to unmute opponent"
                                >
                                    🔊 Click to unmute opponent
                                </button>
                            )}
                            {!remoteStream && (
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
                            {gamePhase === "blackout" && (
                                <div className="blind-conceal-overlay" aria-live="assertive">
                                    <div className="blind-lock-symbol">
                                        <Lock size={44} strokeWidth={2.2} />
                                    </div>
                                    <p className="blind-lock-title">Opponent hidden</p>
                                    <p className="blind-lock-subtitle">Lock in your move!</p>
                                </div>
                            )}
                                {gamePhase === "round_break" && lastRoundResult?.winner === "user" && (
                                    <div className="winner-video-popover">
                                        <Trophy size={20} />
                                        <span>You won this round</span>
                                    </div>
                                )}
                                {gamePhase === "countdown" && (
                                    <div className="game-timer-overlay" aria-live="polite">
                                        {timer}
                                    </div>
                                )}
                        </>
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

                    <div className={`video-viewport local-viewport ${
                        gamePhase === "round_break" ? "break-dimmed" : ""
                    } ${
                        gamePhase === "round_break" && lastRoundResult?.winner === "opponent"
                            ? "result-loser"
                            : ""
                    }`}>
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
                                <Moon size={14} />
                                <span>Camera Dimmed (Break)</span>
                            </div>
                        )}
                        {gamePhase === "round_break" && lastRoundResult?.winner === "opponent" && (
                            <div className="winner-video-popover">
                                <Trophy size={20} />
                                <span>{opponentNickname || "Opponent"} won this round</span>
                            </div>
                        )}
                        <canvas
                            ref={canvasRef}
                            className="hand-tracking-canvas"
                            aria-hidden="true"
                        />
                        {gamePhase === "countdown" && (
                            <div className="game-timer-overlay" aria-live="polite">
                                {timer}
                            </div>
                        )}
                        {gamePhase === "blackout" && (
                            <div className="blind-capture-status" aria-live="assertive">
                                <span>Scanning hand... {timer}s</span>
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
                            <Play size={18} fill="currentColor" />
                            Find Partner
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleStop}
                            className="control-action-btn btn-stop-search"
                            title={isConnected ? "End Call / Stop" : "Stop Searching"}
                        >
                            <Square size={16} fill="currentColor" />
                            Stop
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleNext}
                        className="control-action-btn btn-skip-next"
                        title="Skip to Next Partner"
                    >
                        <SkipForward size={18} fill="currentColor" />
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
