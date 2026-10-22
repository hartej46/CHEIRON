import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { useNickname } from "../context/NicknameContext";
import { initPlayer, getSessionDetails, clearSession } from "../service/service";
import { config } from "../config/Config";

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

export function VideoRoom() {
    const { nickname, setNickname } = useNickname();
    const navigate = useNavigate();

    // Media References
    const videoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);

    // WebRTC & Socket References
    const socketRef = useRef<Socket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const roomIdRef = useRef<string | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

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
        "waiting" | "countdown" | "action" | "reveal"
    >("waiting");
    const [timer, setTimer] = useState(0);

    // Call Duration Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (callState === "connected" && remoteStream) {
            setCallDuration(0);
            interval = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callState, remoteStream]);

    // Start the game loop once the remote WebRTC stream is available.
    useEffect(() => {
        if (remoteStream && gamePhase === "waiting") {
            setGamePhase("countdown");
            setTimer(5);
        }
    }, [remoteStream, gamePhase]);

    // Run the countdown and blind action phases with one cancellable interval.
    useEffect(() => {
        if (gamePhase !== "countdown" && gamePhase !== "action") return;

        const interval = setInterval(() => {
            setTimer((currentTimer) => {
                if (currentTimer <= 1) {
                    if (gamePhase === "countdown") {
                        setGamePhase("action");
                        return 7;
                    }

                    setGamePhase("reveal");
                    return 0;
                }

                return currentTimer - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [gamePhase]);

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
                await getSessionDetails();
            } catch {
                await initPlayer(nickname);
            }
            if (isCancelled) return;

            // Connect Socket.IO
            const socket = io(config.apiURL, {
                withCredentials: true,
            });
            socketRef.current = socket;

            socket.on("connect", () => {
                setCallState("searching");
                setConnectionStatus("Looking for an opponent...");
                socket.emit("find_match");
            });

            socket.on("connect_error", () => {
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
                setConnectionStatus("Opponent disconnected. Find a new partner when ready.");
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
        setConnectionStatus("Matchmaking stopped.");

        if (socketRef.current) {
            socketRef.current.emit("leave_room");
        }
    };

    // Action: Start Searching (after stopped)
    const handleStartSearching = () => {
        setCallState("searching");
        setConnectionStatus("Looking for an opponent...");
        if (socketRef.current) {
            socketRef.current.emit("find_match");
        }
    };

    // Action: Leave Room completely
    const handleLeaveRoom = async () => {
        teardownPeerConnection();
        try {
            await clearSession();
        } catch {
            // ignore
        }
        setNickname("");
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

            {/* Video Stage: transitions smoothly between Original Proportions and WhatsApp Calling Setup */}
            <section
                className={`video-stage ${isConnected ? "mode-whatsapp" : "mode-original"}`}
                aria-label="Video Call Stage"
            >
                {/* Remote Participant Panel */}
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

                    <div className="video-viewport remote-viewport">
                        {remoteStream ? (
                            <>
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className={`stream-video remote-video ${
                                        gamePhase === "action" ? "remote-video-hidden" : ""
                                    }`}
                                />
                                {gamePhase === "action" && (
                                    <div className="action-phase-overlay" aria-label="Action phase">
                                        <span>Action</span>
                                    </div>
                                )}
                                {(gamePhase === "countdown" || gamePhase === "action") && (
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

                {/* Local Participant Panel (Transitions from 50% grid panel to WhatsApp floating PiP) */}
                <article className="panel-local">
                    <div className="panel-header-overlay local-overlay">
                        <div className="participant-badge local-badge">
                            <span className="status-indicator-dot local-dot" />
                            <span className="participant-label">{nickname} (You)</span>
                        </div>
                    </div>

                    <div className="video-viewport local-viewport">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="stream-video local-video active"
                            aria-label="Your local camera stream"
                        />
                    </div>
                </article>

                {/* WHATSAPP-STYLE FLOATING CONTROL BAR (Visible when Connected) */}
                {isConnected && (
                    <div className="whatsapp-floating-control-bar" role="toolbar" aria-label="Call controls">
                        {/* STOP BUTTON (Red End Call) */}
                        <button
                            type="button"
                            onClick={handleStop}
                            className="whatsapp-btn btn-danger"
                            title="Stop / End Call"
                            aria-label="Stop / End Call"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="12" height="12" x="6" y="6" rx="2" fill="currentColor" />
                            </svg>
                        </button>

                        {/* NEXT BUTTON (Skip to next partner) */}
                        <button
                            type="button"
                            onClick={handleNext}
                            className="whatsapp-btn btn-next"
                            title="Next Partner"
                            aria-label="Next Partner"
                        >
                            <span className="next-label">Next</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
                                <line x1="19" x2="19" y1="5" y2="19" />
                            </svg>
                        </button>
                    </div>
                )}
            </section>

            {/* ORIGINAL PROPORTIONS BOTTOM CONTROLS (Visible when Searching or Stopped) */}
            {!isConnected && (
                <footer className="original-controls-bar">
                    <div className="controls-group-center">
                        {callState === "searching" ? (
                            <button
                                type="button"
                                onClick={handleStop}
                                className="control-action-btn btn-stop-search"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <rect width="14" height="14" x="5" y="5" rx="2" />
                                </svg>
                                Stop
                            </button>
                        ) : (
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
                        )}

                        <button
                            type="button"
                            onClick={handleNext}
                            className="control-action-btn btn-skip-next"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 4 15 12 5 20 5 4" />
                                <line x1="19" x2="19" y1="5" y2="19" stroke="currentColor" strokeWidth="3" />
                            </svg>
                            Next
                        </button>
                    </div>
                </footer>
            )}

            {mediaError && (
                <p className="media-error" role="alert">
                    {mediaError}
                </p>
            )}
        </main>
    );
}
