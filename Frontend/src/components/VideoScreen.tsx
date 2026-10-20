import React, { useState, useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import CameraFeed from "./CameraFeed";
import RemoteScreen, { type MatchStatus } from "./RemoteScreen";
import ControlBar from "./ControlBar";
import ChatBox, { type ChatMessage } from "./ChatBox";

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};
interface VideoScreenProps {
    onEnsureLoggedIn: () => Promise<void>;
    isLoggedin: boolean;
    userNickname?: string;
    onCameraActiveChange?: (active: boolean) => void;
}

export const VideoScreen: React.FC<VideoScreenProps> = ({
    onEnsureLoggedIn,
    isLoggedin,
    userNickname,
    onCameraActiveChange,
}) => {
    // Media Stream State
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoStopped, setIsVideoStopped] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<
        "idle" | "requesting" | "granted" | "denied"
    >("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Matching State
    const [status, setStatus] = useState<MatchStatus>("idle");
    const [partnerName, setPartnerName] = useState<string | undefined>(undefined);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // Chat Messages
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const socketRef = useRef<Socket | null>(null);
    const roomIdRef = useRef<string | null>(null);

    // Update parent about camera state
    useEffect(() => {
        onCameraActiveChange?.(isCameraActive);
    }, [isCameraActive, onCameraActiveChange]);

    useEffect(() => {
        if (!localStream) return;

        const socket = io("http://localhost:3000", {
            withCredentials: true,
        });
        let peerConnection: RTCPeerConnection | null = null;
        let pendingCandidates: RTCIceCandidateInit[] = [];

        socketRef.current = socket;

        const closePeerConnection = () => {
            peerConnection?.close();
            peerConnection = null;
            pendingCandidates = [];
        };

        const setupPeerConnection = () => {
            if (peerConnection) return peerConnection;

            const connection = new RTCPeerConnection(ICE_SERVERS);
            peerConnection = connection;

            localStream.getTracks().forEach((track) => {
                connection.addTrack(track, localStream);
            });

            connection.ontrack = (event) => {
                const [stream] = event.streams;
                if (stream) setRemoteStream(stream);
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

        const handleMatchFound = async ({
            roomId,
            initiator,
        }: {
            roomId: string;
            initiator: boolean;
        }) => {
            roomIdRef.current = roomId;
            setStatus("connected");
            setPartnerName("Stranger");

            const connection = setupPeerConnection();
            if (!initiator) return;

            try {
                const offer = await connection.createOffer();
                await connection.setLocalDescription(offer);
                socket.emit("webrtc_offer", {
                    roomId,
                    sdp: offer,
                });
            } catch (error) {
                console.error("Failed to create WebRTC offer.", error);
            }
        };

        const handleOffer = async ({
            roomId,
            sdp,
        }: {
            roomId: string;
            sdp: RTCSessionDescriptionInit;
        }) => {
            roomIdRef.current = roomId;
            const connection = setupPeerConnection();

            try {
                await connection.setRemoteDescription(new RTCSessionDescription(sdp));
                for (const candidate of pendingCandidates) {
                    await connection.addIceCandidate(candidate);
                }
                pendingCandidates = [];

                const answer = await connection.createAnswer();
                await connection.setLocalDescription(answer);
                socket.emit("webrtc_answer", {
                    roomId,
                    sdp: answer,
                });
            } catch (error) {
                console.error("Failed to handle WebRTC offer.", error);
            }
        };

        const handleAnswer = async ({
            sdp,
        }: {
            sdp: RTCSessionDescriptionInit;
        }) => {
            if (!peerConnection) return;

            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
                for (const candidate of pendingCandidates) {
                    await peerConnection.addIceCandidate(candidate);
                }
                pendingCandidates = [];
            } catch (error) {
                console.error("Failed to handle WebRTC answer.", error);
            }
        };

        const handleIceCandidate = async ({
            candidate,
        }: {
            candidate: RTCIceCandidateInit;
        }) => {
            if (!peerConnection || !peerConnection.remoteDescription) {
                pendingCandidates.push(candidate);
                return;
            }

            try {
                await peerConnection.addIceCandidate(candidate);
            } catch (error) {
                console.error("Failed to add WebRTC ICE candidate.", error);
            }
        };

        const handleOpponentDisconnected = () => {
            setRemoteStream(null);
            setPartnerName(undefined);
            setStatus("disconnected");
            closePeerConnection();
        };

        socket.on("match_found", handleMatchFound);
        socket.on("webrtc_offer", handleOffer);
        socket.on("webrtc_answer", handleAnswer);
        socket.on("webrtc_ice_candidate", handleIceCandidate);
        socket.on("opponent_disconnected", handleOpponentDisconnected);
        socket.emit("find_match");
        setStatus("searching");

        return () => {
            socket.off("match_found", handleMatchFound);
            socket.off("webrtc_offer", handleOffer);
            socket.off("webrtc_answer", handleAnswer);
            socket.off("webrtc_ice_candidate", handleIceCandidate);
            socket.off("opponent_disconnected", handleOpponentDisconnected);
            closePeerConnection();
            socket.disconnect();
            if (socketRef.current === socket) socketRef.current = null;
            if (roomIdRef.current) roomIdRef.current = null;
        };
    }, [localStream]);

    // Request browser camera & microphone access
    const handleStartCamera = useCallback(async () => {
        setPermissionStatus("requesting");
        setErrorMessage(null);

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Your browser does not support mediaDevices.getUserMedia");
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user",
                },
                audio: true,
            });

            const response = await fetch("http://localhost:3000/api/session", { // Update with your actual route path
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Pass the user's nickname from your state, or a fallback
            body: JSON.stringify({ nickname: userNickname || "Player" }), 
            credentials: "include", // CRITICAL: This saves the JWT cookie from Fastify
            });

            if (!response.ok) {
            throw new Error("Camera started, but failed to connect to game server.");
            }

            setLocalStream(stream);
            setIsCameraActive(true);
            setPermissionStatus("granted");
            setIsVideoStopped(false);
            setIsMuted(false);
        } catch (err: unknown) {
            setPermissionStatus("denied");
            setIsCameraActive(false);
            const msg =
                err instanceof Error
                    ? err.message
                    : "Unable to access camera. Please allow permissions in your browser.";
            setErrorMessage(msg);
        }
    }, [userNickname]);

    // Stop camera & clean up tracks
    const handleStopCamera = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            setLocalStream(null);
        }
        setIsCameraActive(false);
        setPermissionStatus("idle");
    }, [localStream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [localStream]);

    // Audio Mute toggle
    const handleToggleMute = () => {
        if (!localStream) return;
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const nextState = !isMuted;
            audioTracks.forEach((track) => {
                track.enabled = !nextState;
            });
            setIsMuted(nextState);
        }
    };

    // Video On/Off toggle
    const handleToggleVideo = () => {
        if (!localStream) {
            handleStartCamera();
            return;
        }
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const nextState = !isVideoStopped;
            videoTracks.forEach((track) => {
                track.enabled = !nextState;
            });
            setIsVideoStopped(nextState);
        }
    };

    // Append system message helper
    const addSystemMessage = (text: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `sys_${Date.now()}_${Math.random()}`,
                sender: "system",
                text,
                timestamp: new Date().toISOString(),
            },
        ]);
    };

    // Start matching flow ("Get Started")
    const handleGetStarted = async () => {
        if (!isLoggedin) {
            await onEnsureLoggedIn();
        }

        if (!isCameraActive || !localStream) {
            await handleStartCamera();
        }

        setStatus("searching");
        addSystemMessage("Looking for someone you can chat with...");
    };

    // Skip to next partner
    const handleNext = () => {
        setStatus("searching");
        setPartnerName(undefined);
        addSystemMessage("Connecting to a new partner...");
        socketRef.current?.emit("find_match");
    };

    // Stop/Leave chat
    const handleStop = () => {
        setStatus("idle");
        setPartnerName(undefined);
        setRemoteStream(null);
        addSystemMessage("You have ended the connection.");
    };

    // Handle user sending text chat
    const handleSendMessage = (text: string) => {
        const userMsg: ChatMessage = {
            id: `msg_${Date.now()}`,
            sender: "you",
            text,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
    };

    return (
        <main className="video-screen-layout">
            {/* Dual Video Screen: Side by side like Omegle */}
            <section className="dual-video-grid" aria-label="Video Feed Stage">
                {/* Stranger Video View */}
                <div className="video-col video-col-remote">
                    <RemoteScreen
                        status={status}
                        remoteStream={remoteStream}
                        partnerName={partnerName}
                        onGetStarted={handleGetStarted}
                        onNext={handleNext}
                        onStop={handleStop}
                    />
                </div>

                {/* Local Camera View: Browser camera on the side */}
                <div className="video-col video-col-local">
                    <CameraFeed
                        stream={localStream}
                        isActive={isCameraActive}
                        isMuted={isMuted}
                        isVideoStopped={isVideoStopped}
                        permissionStatus={permissionStatus}
                        errorMessage={errorMessage}
                        userNickname={userNickname}
                        onStartCamera={handleStartCamera}
                        onToggleMute={handleToggleMute}
                        onToggleVideo={handleToggleVideo}
                    />
                </div>
            </section>

            {/* Minimalist Action Controls */}
            <ControlBar
                status={status}
                isCameraActive={isCameraActive}
                isMuted={isMuted}
                isVideoStopped={isVideoStopped}
                onGetStarted={handleGetStarted}
                onNext={handleNext}
                onStop={handleStop}
                onToggleMute={handleToggleMute}
                onToggleVideo={handleToggleVideo}
                onStartCamera={handleStartCamera}
                onStopCamera={handleStopCamera}
            />

            {/* Omegle-style Text Chat and System Log */}
            <ChatBox messages={messages} status={status} onSendMessage={handleSendMessage} />
        </main>
    );
};

export default VideoScreen;
