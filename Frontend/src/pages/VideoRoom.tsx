import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { io, type Socket } from "socket.io-client";
import {
    AlertTriangle,
    Trophy,
    Lock,
    Play,
    Square,
    SkipForward,
    Mic,
    MicOff,
    Video,
    VideoOff,
    Volume2,
    VolumeX,
    User,
    LogOut,
} from "lucide-react";
import { useNickname } from "../context/NicknameContext";
import { useTheme } from "../context/ThemeContext";
import { initPlayer, getSessionDetails, getIceServers } from "../service/service";
import { config } from "../config/Config";
import { ProfileModal } from "../components/ProfileModal";
import { DuelClashStage } from "../components/DuelClashStage";
import {
    SketchArenaDoodles,
    SketchButton,
    SketchDivider,
    SketchRoundPip,
    SketchSurface,
    ThemeToggleButton,
} from "../components/SketchPrimitives";
import { getStoredToken } from "../utils/storage";
import { soundManager } from "../utils/audio";
import "../styles/arena.css";

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
];

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
    const { isDark } = useTheme();
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
    const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE_SERVERS);
    const isInitiatorRef = useRef<boolean>(false);
    const iceRestartAttemptsRef = useRef<number>(0);
    const nicknameRef = useRef<string>(nickname);
    nicknameRef.current = nickname;
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
    const [matchWinner, setMatchWinner] = useState<"user" | "opponent" | "draw" | null>(null);
    const [roundHistory, setRoundHistory] = useState<Array<"user" | "opponent" | "draw">>([]);
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
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [sfxVolume, setSfxVolume] = useState<number>(() => soundManager.getVolume());
    const [isSfxMuted, setIsSfxMuted] = useState<boolean>(() => soundManager.getIsMuted());
    const roundRef = useRef(round);

    useEffect(() => {
        roundRef.current = round;
    }, [round]);

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
                    if (canvas.width !== video.videoWidth) {
                        canvas.width = video.videoWidth;
                    }
                    if (canvas.height !== video.videoHeight) {
                        canvas.height = video.videoHeight;
                    }

                    const result = landmarker.detectForVideo(video, performance.now());
                    const landmarks = result.landmarks[0];

                    if (gamePhaseRef.current === "blackout") {
                        latestCoordinatesRef.current = landmarks
                            ? landmarks.flatMap(({ x, y, z }) => [x, y, z])
                            : null;
                    }

                    if (landmarks) {
                        setCaptureError((prev) => (prev ? null : prev));
                        context.lineCap = "round";
                        context.lineJoin = "round";
                        context.shadowBlur = 0;

                        // Pass 1: Bold hand-inked dark backing stroke
                        context.strokeStyle = "#111111";
                        context.lineWidth = 6.2;
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

                        // Pass 2: Bright Sunny Yellow inner stroke
                        context.strokeStyle = "#FFE566";
                        context.lineWidth = 3;
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

                        // Highlight landmark dots with ink outline
                        for (const index of HAND_HIGHLIGHT_LANDMARKS) {
                            const landmark = landmarks[index];
                            if (!landmark) continue;

                            context.beginPath();
                            context.arc(
                                landmark.x * canvas.width,
                                landmark.y * canvas.height,
                                5.5,
                                0,
                                Math.PI * 2
                            );
                            context.fillStyle = index === 0 ? "#E8635A" : "#4ECDC4";
                            context.fill();
                            context.lineWidth = 2;
                            context.strokeStyle = "#111111";
                            context.stroke();
                        }
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
                round: roundRef.current,
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

    const toggleMic = useCallback(() => {
        const stream = streamRef.current;
        if (!stream) return;
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) return;
        const nextMuted = !isMicMuted;
        audioTracks.forEach((track) => {
            track.enabled = !nextMuted;
        });
        setIsMicMuted(nextMuted);
    }, [isMicMuted]);

    const toggleCamera = useCallback(() => {
        const stream = streamRef.current;
        if (!stream) return;
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) return;
        const nextOff = !isCameraOff;
        videoTracks.forEach((track) => {
            track.enabled = !nextOff;
        });
        setIsCameraOff(nextOff);
    }, [isCameraOff]);

    const toggleSfxMute = useCallback(() => {
        const muted = soundManager.toggleMute();
        setIsSfxMuted(muted);
    }, []);

    const handleSfxVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(event.target.value);
        soundManager.setVolume(val);
        setSfxVolume(val);
        if (val > 0 && soundManager.getIsMuted()) {
            setIsSfxMuted(soundManager.toggleMute());
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
            peerConnectionRef.current.onicecandidateerror = null;
            peerConnectionRef.current.oniceconnectionstatechange = null;
            peerConnectionRef.current.onconnectionstatechange = null;
            peerConnectionRef.current.ontrack = null;
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        isInitiatorRef.current = false;
        iceRestartAttemptsRef.current = 0;
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
        setRoundHistory([]);
        setLastRoundResult(null);
    }, []);

    // Setup WebRTC PeerConnection
    const setupPeerConnection = useCallback(() => {
        let connection = peerConnectionRef.current;
        if (!connection) {
            connection = new RTCPeerConnection({
                iceServers: iceServersRef.current,
                iceCandidatePoolSize: 10,
            });
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

        const attemptIceRestart = async () => {
            if (
                !isInitiatorRef.current ||
                !roomIdRef.current ||
                !socketRef.current ||
                iceRestartAttemptsRef.current >= 3
            ) {
                return;
            }
            iceRestartAttemptsRef.current += 1;
            try {
                connection.restartIce();
                const offer = await connection.createOffer({ iceRestart: true });
                await connection.setLocalDescription(offer);
                socketRef.current.emit("webrtc_offer", {
                    roomId: roomIdRef.current,
                    sdp: connection.localDescription,
                });
            } catch (error) {
                console.error("ICE restart failed:", error);
            }
        };

        connection.onconnectionstatechange = () => {
            if (connection.connectionState === "connected") {
                iceRestartAttemptsRef.current = 0;
                setConnectionStatus("Connected to opponent.");
                setCallState("connected");
            } else if (connection.connectionState === "disconnected") {
                setConnectionStatus("Opponent connection interrupted. Reconnecting...");
            } else if (connection.connectionState === "failed") {
                setConnectionStatus("WebRTC connection failed. Retrying...");
                void attemptIceRestart();
            }
        };

        connection.oniceconnectionstatechange = () => {
            if (connection.iceConnectionState === "failed") {
                setConnectionStatus("Network relay retry in progress...");
                void attemptIceRestart();
            }
        };

        connection.onicecandidateerror = (event) => {
            console.warn("ICE candidate error:", event.errorCode, event.errorText, event.url);
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
                const initRes = await initPlayer(nicknameRef.current);
                if (initRes?.profile) {
                    setUserData(initRes.profile);
                }
            }

            // Fetch STUN/TURN ICE servers from backend before matchmaking
            const iceConfig = await getIceServers();
            if (isCancelled) return;
            iceServersRef.current = iceConfig.iceServers;
            if (!iceConfig.hasTurn) {
                console.warn(
                    "No TURN server configured; connections on strict/college NATs may fail."
                );
            }

            // Connect Socket.IO (use config.apiURL so Vite proxy works on LAN devices too)
            const token = getStoredToken();

            const socket = io(config.apiURL || undefined, {
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
                    isInitiatorRef.current = initiator;
                    iceRestartAttemptsRef.current = 0;
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
                setRoundHistory([]);
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

            socket.on("round_blind_phase", (data: { round: number }) => {
                if (data?.round && data.round !== roundRef.current) return;
                setGamePhase((prev) => (prev === "countdown" ? "blackout" : prev));
                setTimer(BLACKOUT_DURATION_SECONDS);
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

                const evaluatedRoundNum = Math.min(data.round ?? roundRef.current, 5);
                setLastRoundResult({
                    winner: roundWinner,
                    userMove: myMove || "none",
                    opponentMove: oppMove || "none",
                    reason: data.reason || data.result,
                    round: evaluatedRoundNum,
                });
                setRoundHistory((prev) => {
                    const next = [...prev];
                    const idx = Math.max(0, evaluatedRoundNum - 1);
                    next[idx] = roundWinner;
                    return next.slice(0, 5);
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

                    // Trigger sound feedback for round result
                    if (roundWinner === "user") {
                        soundManager.playRoundWin();
                    } else if (roundWinner === "opponent") {
                        soundManager.playRoundLoss();
                    }
                    // For whole match win, user instructed: "and for whole weinninf dont add anyhting"
                }, 1000);
            });

            socket.on("round_error", ({ message }: { message: string }) => {
                console.error("Round error:", message);
                setCaptureError(message || "The round could not be evaluated.");
                setGamePhase("reveal");
                setTimer(3);
                setConnectionStatus(message || "The round could not be evaluated. Retrying...");
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
                const isPlayer1 = data.p1_id ? socket.id === data.p1_id : true;
                if (data.p1_id && data.p2_id) {
                    setScores({
                        user: isPlayer1 ? data.p1_score : data.p2_score,
                        opponent: isPlayer1 ? data.p2_score : data.p1_score,
                    });
                }
                let normalizedWinner: "user" | "opponent" | "draw" = "draw";
                if (data.winner === "player_1") {
                    normalizedWinner = isPlayer1 ? "user" : "opponent";
                } else if (data.winner === "player_2") {
                    normalizedWinner = isPlayer1 ? "opponent" : "user";
                } else if (data.winner === "user" || data.winner === "opponent") {
                    normalizedWinner = data.winner;
                }
                setMatchWinner(normalizedWinner);
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
    }, [initLocalMedia, setupPeerConnection, teardownPeerConnection]);

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

    const isUserRoundWinner =
        (gamePhase === "round_break" && lastRoundResult?.winner === "user") ||
        (gamePhase === "game_over" && matchWinner === "user");
    const isUserRoundLoser =
        (gamePhase === "round_break" && lastRoundResult?.winner === "opponent") ||
        (gamePhase === "game_over" && matchWinner === "opponent");
    const isOpponentRoundWinner =
        (gamePhase === "round_break" && lastRoundResult?.winner === "opponent") ||
        (gamePhase === "game_over" && matchWinner === "opponent");
    const isOpponentRoundLoser =
        (gamePhase === "round_break" && lastRoundResult?.winner === "user") ||
        (gamePhase === "game_over" && matchWinner === "user");

    const activeRoundDisplay = Math.min(Math.max(round, 1), 5);
    const neutralSurfaceFill = isDark ? "#1C1C21" : "#FFFFFF";

    const localCardFill = isUserRoundWinner
        ? "#4ECDC4"
        : isUserRoundLoser
          ? "#F9A8B8"
          : neutralSurfaceFill;
    const remoteCardFill = isOpponentRoundWinner
        ? "#4ECDC4"
        : isOpponentRoundLoser
          ? "#F9A8B8"
          : neutralSurfaceFill;

    return (
        <main className="arena-page">
            <div className="arena-paper-dots" aria-hidden="true" />
            <SketchArenaDoodles />

            {/* Top Bar: Brand (Left) | Scorecard HUD (Center) | Profile & Leave (Right) */}
            <header className="arena-topbar">
                <div className="arena-brand-wrap">
                    <SketchSurface
                        fill="#FFE566"
                        shadow={3}
                        radius={14}
                        seed="arena-brand"
                        className="arena-brand"
                        innerClassName="arena-brand-inner"
                    >
                        <span
                            className={`arena-brand-dot ${
                                isConnected
                                    ? "live"
                                    : callState === "searching"
                                      ? "searching"
                                      : ""
                            }`}
                        />
                        <span className="arena-brand-name">cheiron</span>
                        <SketchDivider orientation="vertical" length={16} color="#111111" variant="wobble" />
                        <span className="arena-brand-status">
                            {isConnected ? formatDuration(callDuration) : callState === "searching" ? "searching" : "idle"}
                        </span>
                    </SketchSurface>
                </div>

                {/* Top-Center Scorecard */}
                <section className="arena-scorecard" aria-label="Match Scorecard">
                    <SketchSurface
                        as="span"
                        fill="#FFE566"
                        shadow={2}
                        radius={999}
                        seed="scorecard-label"
                        className="scorecard-label-pill"
                        innerClassName="scorecard-label-inner"
                    >
                        scorecard
                    </SketchSurface>

                    <SketchSurface
                        fill={neutralSurfaceFill}
                        shadow={5}
                        radius={16}
                        seed="scorecard-body"
                        className="scorecard-body"
                        innerClassName="scorecard-body-inner"
                    >
                        <div
                            className={`scorecard-side side-you ${
                                isUserRoundWinner
                                    ? "is-winner"
                                    : isUserRoundLoser
                                      ? "is-loser"
                                      : ""
                            }`}
                        >
                            <div className="scorecard-player-meta">
                                <span className="scorecard-player-name">{nickname || "you"}</span>
                                <span
                                    className={`scorecard-outcome-tag ${
                                        isUserRoundWinner
                                            ? "win"
                                            : isUserRoundLoser
                                              ? "loss"
                                              : "neutral"
                                    }`}
                                >
                                    {isUserRoundWinner
                                        ? "winner"
                                        : isUserRoundLoser
                                          ? "loser"
                                          : "you"}
                                </span>
                            </div>
                            <span className="scorecard-num">{scores.user}</span>
                        </div>

                        <div className="scorecard-center-divider" aria-hidden="true">
                            <SketchDivider orientation="vertical" length={34} variant="zigzag" />
                        </div>

                        <div
                            className={`scorecard-side side-opponent ${
                                isOpponentRoundWinner
                                    ? "is-winner"
                                    : isOpponentRoundLoser
                                      ? "is-loser"
                                      : ""
                            }`}
                        >
                            <span className="scorecard-num">{scores.opponent}</span>
                            <div className="scorecard-player-meta">
                                <span className="scorecard-player-name">
                                    {isConnected ? opponentNickname || "stranger" : "stranger"}
                                </span>
                                <span
                                    className={`scorecard-outcome-tag ${
                                        isOpponentRoundWinner
                                            ? "win"
                                            : isOpponentRoundLoser
                                              ? "loss"
                                              : "neutral"
                                    }`}
                                >
                                    {isOpponentRoundWinner
                                        ? "winner"
                                        : isOpponentRoundLoser
                                          ? "loser"
                                          : "opponent"}
                                </span>
                            </div>
                        </div>
                    </SketchSurface>

                    <div className="scorecard-footer">
                        <div className="scorecard-pips" aria-label="Round history">
                            {[0, 1, 2, 3, 4].map((index) => {
                                const outcome = roundHistory[index];
                                const isCurrent = isConnected && round > 0 && index === round - 1 && !outcome;
                                return (
                                    <SketchRoundPip
                                        key={index}
                                        index={index}
                                        outcome={outcome}
                                        isCurrent={isCurrent}
                                    />
                                );
                            })}
                        </div>
                        <span className="scorecard-round-text">
                            {isConnected && round > 0
                                ? `round ${activeRoundDisplay} of 5`
                                : "best of 5"}
                        </span>
                    </div>
                </section>

                {/* Top-Right Theme Toggle, Profile & Leave */}
                <div className="arena-header-actions">
                    <ThemeToggleButton seed="arena-theme-toggle" />

                    <SketchButton
                        fill="#C4B5FD"
                        shadow={3}
                        radius={999}
                        seed="arena-profile-btn"
                        className="arena-profile-btn"
                        faceClassName="arena-profile-face"
                        onClick={() => setIsProfileOpen(true)}
                        title="View Profile"
                        aria-label="Open user profile"
                    >
                        <span className="arena-profile-avatar">
                            <User size={13} strokeWidth={2.4} />
                        </span>
                        <span className="arena-profile-name">{nickname}</span>
                    </SketchButton>

                    <SketchButton
                        fill={neutralSurfaceFill}
                        shadow={3}
                        radius={12}
                        seed="arena-leave-btn"
                        className="arena-leave-btn"
                        faceClassName="arena-leave-face"
                        onClick={handleLeaveRoom}
                        title="Leave room"
                    >
                        <LogOut size={13} strokeWidth={2.4} />
                        <span>leave</span>
                    </SketchButton>
                </div>
            </header>

            {/* Main Content: Permission Barrier OR 39% | 22% | 39% Arena Stage */}
            {hasMediaPermissions === false ? (
                <div className="arena-permission-overlay">
                    <SketchSurface
                        fill={neutralSurfaceFill}
                        shadow={6}
                        radius={20}
                        seed="perm-card"
                        className="arena-permission-card"
                        innerClassName="arena-permission-inner"
                        role="alert"
                    >
                        <div className="perm-icon-circle">
                            <AlertTriangle size={28} strokeWidth={2.4} color="#111111" />
                        </div>
                        <h2>camera and microphone required</h2>
                        <p>
                            allow camera and microphone access so cheiron can track your
                            hand gestures and connect you with an opponent.
                        </p>
                        <SketchButton
                            fill="#4ECDC4"
                            shadow={4}
                            radius={12}
                            seed="perm-cta"
                            onClick={initLocalMedia}
                            faceClassName="duel-primary-cta-face"
                        >
                            <span>grant camera & mic access</span>
                        </SketchButton>
                    </SketchSurface>
                </div>
            ) : (
                <section className="arena-stage" aria-label="Match Arena">
                    {/* Left Panel (39%): Local Camera (YOU) */}
                    <SketchSurface
                        as="article"
                        fill={localCardFill}
                        shadow={6}
                        radius={20}
                        seed="local-video-card"
                        className={`arena-video-card card-local ${
                            isUserRoundWinner
                                ? "card-round-winner"
                                : isUserRoundLoser
                                  ? "card-round-loser"
                                  : ""
                        }`}
                        innerClassName="arena-video-card-inner"
                    >
                        <div className="arena-video-viewport">
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`arena-stream-video is-mirrored ${
                                    isUserRoundLoser ? "arena-video-dimmed" : ""
                                } ${isCameraOff ? "is-camera-off" : ""}`}
                                aria-label="Your local camera stream"
                            />

                            {isCameraOff && (
                                <div className="arena-camera-off-placeholder">
                                    <div className="placeholder-icon-circle">
                                        <VideoOff size={22} strokeWidth={2.4} />
                                    </div>
                                    <span>camera is off</span>
                                </div>
                            )}

                            <canvas
                                ref={canvasRef}
                                className="arena-hand-canvas"
                                aria-hidden="true"
                            />

                            {isUserRoundLoser && (
                                <div className="arena-loser-veil" aria-hidden="true" />
                            )}

                            {gamePhase === "blackout" && (
                                <div className="arena-scan-badge" aria-live="assertive">
                                    <span className="arena-scan-dot" />
                                    <span>scanning {timer}s</span>
                                </div>
                            )}

                            {captureError && (
                                <div className="arena-capture-toast" role="alert">
                                    <AlertTriangle size={14} strokeWidth={2.4} />
                                    <span>{captureError}</span>
                                </div>
                            )}

                            <div className="arena-card-bottom-bar">
                                <span className="arena-name-pill">
                                    <span>{nickname || "you"}</span>
                                    <span className="arena-name-tag-role">you</span>
                                </span>

                                {isUserRoundWinner && (
                                    <span className="arena-card-outcome-pill win">
                                        <Trophy size={12} strokeWidth={2.5} />
                                        <span>{gamePhase === "game_over" ? "match won" : "round won"}</span>
                                    </span>
                                )}
                                {isUserRoundLoser && (
                                    <span className="arena-card-outcome-pill loss">
                                        <span>{gamePhase === "game_over" ? "defeated" : "round lost"}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </SketchSurface>

                    {/* Center Column (22%): Hand-Drawn 3D Gesture Clash & Live Match State */}
                    <section className="arena-center-duel" aria-label="Duel Center Stage">
                        <DuelClashStage
                            callState={callState}
                            gamePhase={gamePhase}
                            timer={timer}
                            round={round}
                            scores={scores}
                            lastRoundResult={lastRoundResult}
                            matchWinner={matchWinner}
                            connectionStatus={connectionStatus}
                            opponentNickname={opponentNickname}
                            onStartSearching={handleStartSearching}
                            onNextOpponent={handleNext}
                        />
                    </section>

                    {/* Right Panel (39%): Remote Opponent (STRANGER) */}
                    <SketchSurface
                        as="article"
                        fill={remoteCardFill}
                        shadow={6}
                        radius={20}
                        seed="remote-video-card"
                        className={`arena-video-card card-remote ${
                            isOpponentRoundWinner
                                ? "card-round-winner"
                                : isOpponentRoundLoser
                                  ? "card-round-loser"
                                  : ""
                        }`}
                        innerClassName="arena-video-card-inner"
                    >
                        <div className="arena-video-viewport">
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
                                className={`arena-stream-video ${
                                    isOpponentRoundLoser ? "arena-video-dimmed" : ""
                                }`}
                                style={
                                    remoteStream
                                        ? undefined
                                        : {
                                              position: "absolute",
                                              inset: 0,
                                              opacity: 0,
                                              pointerEvents: "none",
                                          }
                                }
                                aria-label="Opponent video stream"
                            />

                            {!remoteStream && (
                                <div className="arena-remote-empty">
                                    <div className="arena-remote-empty-icon">
                                        <User size={22} strokeWidth={2.4} />
                                    </div>
                                    <p>
                                        {callState === "searching"
                                            ? "waiting for a stranger to join..."
                                            : "not currently in a match."}
                                    </p>
                                </div>
                            )}

                            {isOpponentRoundLoser && remoteStream && (
                                <div className="arena-loser-veil" aria-hidden="true" />
                            )}

                            {gamePhase === "blackout" && remoteStream && (
                                <div className="arena-blackout-curtain" aria-live="assertive">
                                    <div className="arena-blackout-card">
                                        <div className="arena-blackout-icon">
                                            <Lock size={22} strokeWidth={2.5} />
                                        </div>
                                        <p className="arena-blackout-title">opponent hidden</p>
                                        <p className="arena-blackout-sub">lock in your move</p>
                                    </div>
                                </div>
                            )}

                            <div className="arena-card-top-bar">
                                {isConnected ? (
                                    <span className="arena-live-pill">
                                        <span className="arena-live-dot" />
                                        <span>live</span>
                                    </span>
                                ) : (
                                    <span />
                                )}

                                {isRemoteAudioMuted && isConnected && (
                                    <SketchButton
                                        fill="#FFE566"
                                        shadow={3}
                                        radius={999}
                                        seed="unmute-remote"
                                        onClick={handleUnmuteRemote}
                                        className="arena-unmute-btn"
                                        faceClassName="arena-unmute-face"
                                        title="Click to unmute opponent"
                                    >
                                        <Volume2 size={13} strokeWidth={2.4} />
                                        <span>unmute</span>
                                    </SketchButton>
                                )}
                            </div>

                            <div className="arena-card-bottom-bar">
                                <span className="arena-name-pill">
                                    <span>{isConnected ? opponentNickname || "stranger" : "stranger"}</span>
                                    <span className="arena-name-tag-role">opponent</span>
                                </span>

                                {isOpponentRoundWinner && (
                                    <span className="arena-card-outcome-pill win">
                                        <Trophy size={12} strokeWidth={2.5} />
                                        <span>{gamePhase === "game_over" ? "match won" : "round won"}</span>
                                    </span>
                                )}
                                {isOpponentRoundLoser && (
                                    <span className="arena-card-outcome-pill loss">
                                        <span>{gamePhase === "game_over" ? "defeated" : "round lost"}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </SketchSurface>
                </section>
            )}

            {/* Bottom Control Dock: Left (Stop / Next) | Center (Empty) | Right (SFX / Mic / Camera) */}
            <footer className="arena-dock">
                <div className="arena-dock-left">
                    {callState === "stopped" ? (
                        <SketchButton
                            fill="#4ECDC4"
                            shadow={4}
                            radius={12}
                            seed="dock-start"
                            onClick={handleStartSearching}
                            className="dock-btn dock-btn-start"
                            faceClassName="dock-btn-face"
                        >
                            <Play size={15} fill="#111111" strokeWidth={2.2} />
                            <span>find partner</span>
                        </SketchButton>
                    ) : (
                        <SketchButton
                            fill="#E8635A"
                            shadow={4}
                            radius={12}
                            seed="dock-stop"
                            onClick={handleStop}
                            className="dock-btn dock-btn-stop"
                            faceClassName="dock-btn-face dock-btn-face-darktext"
                            title={isConnected ? "End Call / Stop" : "Stop Searching"}
                        >
                            <Square size={14} fill="#FFFFFF" stroke="#FFFFFF" />
                            <span>stop</span>
                        </SketchButton>
                    )}

                    <SketchButton
                        fill="#FFE566"
                        shadow={4}
                        radius={12}
                        seed="dock-next"
                        onClick={handleNext}
                        className="dock-btn dock-btn-next"
                        faceClassName="dock-btn-face"
                        title="Skip to Next Partner"
                    >
                        <SkipForward size={15} fill="#111111" strokeWidth={2.2} />
                        <span>next</span>
                    </SketchButton>
                </div>

                <div className="arena-dock-center" aria-hidden="true" />

                <div className="arena-dock-right">
                    {/* Sound Effects (SFX) Volume & Mute Controls */}
                    <SketchSurface
                        fill="#C4B5FD"
                        shadow={3}
                        radius={999}
                        seed="dock-sfx"
                        className="dock-sfx-group"
                        innerClassName="dock-sfx-inner"
                    >
                        <button
                            type="button"
                            onClick={toggleSfxMute}
                            className={`dock-sfx-btn ${isSfxMuted || sfxVolume === 0 ? "is-muted" : ""}`}
                            aria-label={isSfxMuted ? "Unmute sound effects" : "Mute sound effects"}
                            title={isSfxMuted ? "Unmute sound effects" : "Mute sound effects"}
                        >
                            {isSfxMuted || sfxVolume === 0 ? <VolumeX size={15} strokeWidth={2.4} /> : <Volume2 size={15} strokeWidth={2.4} />}
                            <span>sfx</span>
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isSfxMuted ? 0 : sfxVolume}
                            onChange={handleSfxVolumeChange}
                            className="dock-sfx-slider"
                            aria-label="Sound effects volume slider"
                            title={`Volume: ${isSfxMuted ? 0 : Math.round(sfxVolume * 100)}%`}
                        />
                        <span className="dock-sfx-val">
                            {isSfxMuted ? "0%" : `${Math.round(sfxVolume * 100)}%`}
                        </span>
                    </SketchSurface>

                    <SketchButton
                        fill={isMicMuted ? "#F9A8B8" : neutralSurfaceFill}
                        shadow={4}
                        radius={12}
                        seed="dock-mic"
                        onClick={toggleMic}
                        disabled={hasMediaPermissions !== true}
                        className={`dock-toggle-pill ${isMicMuted ? "is-off" : ""}`}
                        faceClassName="dock-toggle-face"
                        aria-pressed={!isMicMuted}
                        aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                    >
                        <span className="dock-toggle-label">
                            {isMicMuted ? <MicOff size={15} strokeWidth={2.4} /> : <Mic size={15} strokeWidth={2.4} />}
                            <span>mic</span>
                        </span>
                        <span className="dock-switch-track" aria-hidden="true">
                            <span className="dock-switch-thumb" />
                        </span>
                    </SketchButton>

                    <SketchButton
                        fill={isCameraOff ? "#F9A8B8" : neutralSurfaceFill}
                        shadow={4}
                        radius={12}
                        seed="dock-camera"
                        onClick={toggleCamera}
                        disabled={hasMediaPermissions !== true}
                        className={`dock-toggle-pill ${isCameraOff ? "is-off" : ""}`}
                        faceClassName="dock-toggle-face"
                        aria-pressed={!isCameraOff}
                        aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
                    >
                        <span className="dock-toggle-label">
                            {isCameraOff ? <VideoOff size={15} strokeWidth={2.4} /> : <Video size={15} strokeWidth={2.4} />}
                            <span>camera</span>
                        </span>
                        <span className="dock-switch-track" aria-hidden="true">
                            <span className="dock-switch-thumb" />
                        </span>
                    </SketchButton>
                </div>
            </footer>

            {mediaError && (
                <p className="arena-media-error" role="alert">
                    {mediaError}
                </p>
            )}

            {/* Profile Modal */}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onDeleted={handleLeaveRoom}
                variant="neobrutal"
            />
        </main>
    );
}
