import React, { useState, useEffect, useRef, useCallback } from "react";
import CameraFeed from "./CameraFeed";
import RemoteScreen, { type MatchStatus } from "./RemoteScreen";
import ControlBar from "./ControlBar";
import ChatBox, { type ChatMessage } from "./ChatBox";

interface VideoScreenProps {
    onEnsureLoggedIn: () => Promise<void>;
    isLoggedin: boolean;
    userNickname?: string;
    onCameraActiveChange?: (active: boolean) => void;
}

const STRANGER_NAMES = [
    "Stranger_Tokyo",
    "Stranger_Berlin",
    "Stranger_Oslo",
    "Stranger_London",
    "Stranger_Kyoto",
    "Stranger_Zurich",
];

const SIMULATED_STRANGER_REPLIES = [
    "Hey! How is it going?",
    "Hello from the other side of the world!",
    "Hi there! Love the clean minimalist interface here.",
    "Hey! What are you building today?",
    "Greetings! Nice to meet you.",
];

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
    const [remoteStream] = useState<MediaStream | null>(null);

    // Chat Messages
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const replyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Update parent about camera state
    useEffect(() => {
        onCameraActiveChange?.(isCameraActive);
    }, [isCameraActive, onCameraActiveChange]);

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
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);
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

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            const randomPartner = STRANGER_NAMES[Math.floor(Math.random() * STRANGER_NAMES.length)];
            setPartnerName(randomPartner);
            setStatus("connected");
            addSystemMessage("You're now chatting with a random stranger. Say hi!");
        }, 1500);
    };

    // Skip to next partner
    const handleNext = () => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);

        setStatus("searching");
        setPartnerName(undefined);
        addSystemMessage("Connecting to a new partner...");

        searchTimeoutRef.current = setTimeout(() => {
            const randomPartner = STRANGER_NAMES[Math.floor(Math.random() * STRANGER_NAMES.length)];
            setPartnerName(randomPartner);
            setStatus("connected");
            addSystemMessage("You're now chatting with a random stranger. Say hi!");
        }, 1200);
    };

    // Stop/Leave chat
    const handleStop = () => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);

        setStatus("idle");
        setPartnerName(undefined);
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

        // Stranger auto-reply simulation
        if (status === "connected") {
            if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);
            replyTimeoutRef.current = setTimeout(() => {
                const randomReply =
                    SIMULATED_STRANGER_REPLIES[
                        Math.floor(Math.random() * SIMULATED_STRANGER_REPLIES.length)
                    ];
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `rep_${Date.now()}`,
                        sender: "stranger",
                        text: randomReply,
                        timestamp: new Date().toISOString(),
                    },
                ]);
            }, 1000);
        }
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
