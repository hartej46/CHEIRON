import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { useNickname } from "../context/NicknameContext";
import { initPlayer } from "../service/service";

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

export function VideoRoom() {
    const { nickname } = useNickname();
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const roomIdRef = useRef<string | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [hasStream, setHasStream] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState("Waiting for connection...");
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            peerConnectionRef.current?.close();
            socketRef.current?.disconnect();
        };
    }, []);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = cameraEnabled ? streamRef.current : null;
        }
    }, [cameraEnabled]);

    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
    }, [connectionStatus]);

    useEffect(() => {
        if (!streamRef.current || socketRef.current) return;

        let cancelled = false;

        const startMatchmaking = async () => {
            try {
                await initPlayer(nickname);
                if (cancelled) return;

                const socket = io("http://localhost:3000", {
                    withCredentials: true,
                });
                socketRef.current = socket;

                const setupPeerConnection = () => {
                    if (peerConnectionRef.current) return peerConnectionRef.current;

                    const connection = new RTCPeerConnection(ICE_SERVERS);
                    peerConnectionRef.current = connection;
                    streamRef.current?.getTracks().forEach((track) => {
                        connection.addTrack(track, streamRef.current!);
                    });
                    connection.ontrack = (event) => {
                        remoteStreamRef.current = event.streams[0] || null;
                        setRemoteStream(remoteStreamRef.current);
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = remoteStreamRef.current;
                        }
                    };
                    connection.onicecandidate = (event) => {
                        if (event.candidate && roomIdRef.current) {
                            socket.emit("webrtc_ice_candidate", {
                                roomId: roomIdRef.current,
                                candidate: event.candidate.toJSON(),
                            });
                        }
                    };
                    return connection;
                };

                socket.on("connect", () => {
                    setConnectionStatus("Looking for an opponent...");
                    socket.emit("find_match");
                });
                socket.on("connect_error", () => {
                    setConnectionStatus("Unable to connect to the server.");
                });
                socket.on("waiting_for_opponent", () => {
                    setConnectionStatus("Waiting for an opponent...");
                });
                socket.on("match_found", async ({ roomId, initiator }) => {
                    roomIdRef.current = roomId;
                    setConnectionStatus("Connecting to opponent...");
                    const connection = setupPeerConnection();
                    if (!initiator) return;

                    const offer = await connection.createOffer();
                    await connection.setLocalDescription(offer);
                    socket.emit("webrtc_offer", { roomId, sdp: offer });
                });
                socket.on("webrtc_offer", async ({ roomId, sdp }) => {
                    roomIdRef.current = roomId;
                    const connection = setupPeerConnection();
                    await connection.setRemoteDescription(sdp);
                    for (const candidate of pendingCandidatesRef.current) {
                        await connection.addIceCandidate(candidate);
                    }
                    pendingCandidatesRef.current = [];
                    const answer = await connection.createAnswer();
                    await connection.setLocalDescription(answer);
                    socket.emit("webrtc_answer", { roomId, sdp: answer });
                });
                socket.on("webrtc_answer", async ({ sdp }) => {
                    if (!peerConnectionRef.current) return;
                    await peerConnectionRef.current.setRemoteDescription(sdp);
                    for (const candidate of pendingCandidatesRef.current) {
                        await peerConnectionRef.current.addIceCandidate(candidate);
                    }
                    pendingCandidatesRef.current = [];
                });
                socket.on("webrtc_ice_candidate", async ({ candidate }) => {
                    if (!peerConnectionRef.current?.remoteDescription) {
                        pendingCandidatesRef.current.push(candidate);
                        return;
                    }
                    await peerConnectionRef.current.addIceCandidate(candidate);
                });
                socket.on("opponent_disconnected", () => {
                    remoteStreamRef.current = null;
                    setRemoteStream(null);
                    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
                    peerConnectionRef.current?.close();
                    peerConnectionRef.current = null;
                    setConnectionStatus("Opponent disconnected.");
                });
            } catch (error) {
                console.error("Unable to start matchmaking.", error);
                setConnectionStatus(
                    error instanceof Error
                        ? `Unable to start matchmaking: ${error.message}`
                        : "Unable to start matchmaking."
                );
            }
        };

        void startMatchmaking();

        return () => {
            cancelled = true;
        };
    }, [nickname, cameraEnabled]);

    const enableCamera = async () => {
        setMediaError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = stream;
            setHasStream(true);

            setCameraEnabled(true);
            setAudioEnabled(stream.getAudioTracks().some((track) => track.enabled));
        } catch {
            setMediaError(
                "Camera or microphone access was denied. Check your browser permissions."
            );
        }
    };

    const disableCamera = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setHasStream(false);
        setCameraEnabled(false);
        setAudioEnabled(false);
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        socketRef.current?.disconnect();
        socketRef.current = null;
        remoteStreamRef.current = null;
        setRemoteStream(null);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setConnectionStatus("Waiting for connection...");
    };

    const toggleAudio = () => {
        const nextAudioEnabled = !audioEnabled;
        streamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = nextAudioEnabled;
        });
        setAudioEnabled(nextAudioEnabled);
        // TODO: Signal the mute state to the remote peer.
    };

    return (
        <main className="room-page">
            <header className="room-header">
                <div>
                    <p className="eyebrow">CHEIRON / VIDEO CHAT</p>
                    <h1>Video room</h1>
                </div>
                <button
                    type="button"
                    className="text-button"
                    onClick={() => navigate("/")}
                >
                    Leave room
                </button>
            </header>

            <section className="video-grid" aria-label="Video feeds">
                <article className="video-panel">
                    <div className="video-panel-heading">
                        <span>01</span>
                        <h2>Stranger (remote)</h2>
                    </div>
                    <div className="video-placeholder remote-placeholder">
                        {remoteStream ? (
                            <video ref={remoteVideoRef} autoPlay playsInline />
                        ) : (
                            <span>{connectionStatus}</span>
                        )}
                    </div>
                </article>

                <article className="video-panel">
                    <div className="video-panel-heading">
                        <span>02</span>
                        <h2>You (local)</h2>
                    </div>
                    <div className="video-placeholder local-placeholder">
                        {cameraEnabled ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                aria-label="Your local camera feed"
                            />
                        ) : (
                            <span>Camera is off</span>
                        )}
                    </div>
                    <p className="participant-name">{nickname}</p>
                </article>
            </section>

            {mediaError && (
                <p className="media-error" role="alert">
                    {mediaError}
                </p>
            )}

            <footer className="room-controls">
                <button
                    type="button"
                    className="secondary-button"
                    onClick={cameraEnabled ? disableCamera : enableCamera}
                >
                    {cameraEnabled ? "Disable camera" : "Enable camera"}
                </button>
                <button
                    type="button"
                    className="secondary-button"
                    onClick={toggleAudio}
                    disabled={!hasStream}
                >
                    {audioEnabled ? "Mute" : "Unmute"}
                </button>
            </footer>
        </main>
    );
}
