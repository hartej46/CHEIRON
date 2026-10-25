import React, { useEffect, useRef } from "react";

export type MatchStatus = "idle" | "searching" | "connected" | "disconnected";

interface RemoteScreenProps {
    status: MatchStatus;
    remoteStream: MediaStream | null;
    hideVideo?: boolean;
    partnerName?: string;
    onGetStarted: () => void;
    onNext: () => void;
    onStop: () => void;
}

export const RemoteScreen: React.FC<RemoteScreenProps> = ({
    status,
    remoteStream,
    hideVideo = false,
    partnerName,
    onGetStarted,
    onNext,
    onStop,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        if (videoRef.current) {
            if (remoteStream && status === "connected") {
                videoRef.current.srcObject = remoteStream;
            } else {
                videoRef.current.srcObject = null;
            }
        }
    }, [remoteStream, status]);

    return (
        <div className="camera-feed-card">
            <div className="video-viewport remote-viewport">
                {status === "connected" && remoteStream ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className={`video-element ${hideVideo ? "blind-phase-video" : ""}`}
                        />
                        {hideVideo && (
                            <div className="blind-phase-placeholder">
                                Opponent is choosing...
                            </div>
                        )}
                    </>
                ) : (
                    <div className="video-empty-state remote-empty">
                        {status === "searching" ? (
                            <div className="empty-message-wrap">
                                <div className="minimal-pulsing-rings">
                                    <div className="ring ring-1" />
                                    <div className="ring ring-2" />
                                </div>
                                <p className="empty-title">Looking for a stranger...</p>
                                <span className="empty-sub">
                                    Searching for available connections.
                                </span>
                                <button
                                    type="button"
                                    onClick={onStop}
                                    className="btn-minimal btn-minimal-secondary btn-small"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : status === "disconnected" ? (
                            <div className="empty-message-wrap">
                                <span className="empty-icon">✕</span>
                                <p className="empty-title">Stranger Disconnected</p>
                                <span className="empty-sub">
                                    Your previous partner has left the conversation.
                                </span>
                                <button
                                    type="button"
                                    onClick={onNext}
                                    className="btn-minimal btn-minimal-primary btn-small"
                                >
                                    Find Someone New
                                </button>
                            </div>
                        ) : status === "connected" && !remoteStream ? (
                            <div className="empty-message-wrap">
                                <div className="partner-avatar-circle">
                                    {partnerName ? partnerName.charAt(0).toUpperCase() : "S"}
                                </div>
                                <p className="empty-title">
                                    Connected to {partnerName || "Stranger"}
                                </p>
                                <span className="empty-sub">
                                    Establishing secure peer-to-peer video stream...
                                </span>
                            </div>
                        ) : (
                            <div className="empty-message-wrap">
                                <div className="camera-icon-glyph">
                                    <svg
                                        width="32"
                                        height="32"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </div>
                                <p className="empty-title">Stranger Screen</p>
                                <span className="empty-sub">
                                    Click "Get Started" to find and connect with someone.
                                </span>
                                <button
                                    type="button"
                                    onClick={onGetStarted}
                                    className="btn-minimal btn-minimal-primary btn-small"
                                >
                                    Get Started
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Badge header */}
                <div className="video-badge-bar top-left">
                    <span className="feed-tag">
                        {status === "connected"
                            ? `STRANGER (${partnerName || "Peer"})`
                            : "STRANGER (REMOTE)"}
                    </span>
                    {status === "connected" && (
                        <span className="live-pill">
                            <span className="live-dot" /> CONNECTED
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RemoteScreen;
