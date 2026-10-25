import React, { useEffect, useRef } from "react";

interface CameraFeedProps {
    stream: MediaStream | null;
    isActive: boolean;
    isMuted: boolean;
    isVideoStopped: boolean;
    permissionStatus: "idle" | "requesting" | "granted" | "denied";
    errorMessage: string | null;
    userNickname?: string;
    onStartCamera: () => Promise<void>;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    canvasRef?: React.RefObject<HTMLCanvasElement | null>;
    onVideoLoadedData?: () => void;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
    stream,
    isActive,
    isMuted,
    isVideoStopped,
    permissionStatus,
    errorMessage,
    userNickname,
    onStartCamera,
    onToggleMute,
    onToggleVideo,
    videoRef: externalVideoRef,
    canvasRef,
    onVideoLoadedData,
}) => {
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);
    const videoRef = externalVideoRef || internalVideoRef;

    useEffect(() => {
        if (videoRef.current) {
            if (stream && isActive) {
                videoRef.current.srcObject = stream;
            } else {
                videoRef.current.srcObject = null;
            }
        }
    }, [stream, isActive]);

    return (
        <div className="camera-feed-card">
            <div
                className="video-viewport"
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    aspectRatio: "16 / 9",
                }}
            >
                {isActive && stream && !isVideoStopped ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            onLoadedData={onVideoLoadedData}
                            className="video-element mirrored"
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transform: "scaleX(-1)",
                            }}
                        />
                        {canvasRef && (
                            <canvas
                                ref={canvasRef}
                                width={0}
                                height={0}
                                aria-hidden="true"
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    zIndex: 10,
                                    pointerEvents: "none",
                                    transform: "scaleX(-1)",
                                }}
                            />
                        )}
                    </>
                ) : (
                    <div className="video-empty-state">
                        {permissionStatus === "requesting" ? (
                            <div className="empty-message-wrap">
                                <div className="minimal-spinner" />
                                <p className="empty-title">Requesting camera access...</p>
                                <span className="empty-sub">
                                    Please allow camera permissions in your browser.
                                </span>
                            </div>
                        ) : permissionStatus === "denied" ? (
                            <div className="empty-message-wrap">
                                <span className="empty-icon">⚠</span>
                                <p className="empty-title">Camera Permission Denied</p>
                                <span className="empty-sub">
                                    {errorMessage ||
                                        "Check your browser settings to grant camera access."}
                                </span>
                                <button
                                    type="button"
                                    onClick={onStartCamera}
                                    className="btn-minimal btn-minimal-secondary btn-small"
                                >
                                    Retry Access
                                </button>
                            </div>
                        ) : isVideoStopped ? (
                            <div className="empty-message-wrap">
                                <p className="empty-title">Camera Paused</p>
                                <button
                                    type="button"
                                    onClick={onToggleVideo}
                                    className="btn-minimal btn-minimal-primary btn-small"
                                >
                                    Turn Camera On
                                </button>
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
                                        <path d="M23 7l-7 5 7 5V7z" />
                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                    </svg>
                                </div>
                                <p className="empty-title">Your Camera</p>
                                <span className="empty-sub">
                                    Allow browser camera access to preview your video.
                                </span>
                                <button
                                    type="button"
                                    onClick={onStartCamera}
                                    className="btn-minimal btn-minimal-primary btn-small"
                                >
                                    Enable Camera
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Feed header badge */}
                <div className="video-badge-bar top-left">
                    <span className="feed-tag">
                        {userNickname ? `${userNickname.toUpperCase()} (YOU)` : "YOU (LOCAL)"}
                    </span>
                    {isActive && !isVideoStopped && (
                        <span className="live-pill">
                            <span className="live-dot" /> LIVE
                        </span>
                    )}
                </div>

                {/* In-video floating quick toggles */}
                {isActive && (
                    <div className="video-badge-bar bottom-right">
                        <button
                            type="button"
                            onClick={onToggleMute}
                            className={`mini-toggle-btn ${isMuted ? "toggle-btn-alert" : ""}`}
                            title={isMuted ? "Unmute microphone" : "Mute microphone"}
                        >
                            {isMuted ? "Mic Off" : "Mic On"}
                        </button>
                        <button
                            type="button"
                            onClick={onToggleVideo}
                            className={`mini-toggle-btn ${isVideoStopped ? "toggle-btn-alert" : ""}`}
                            title={isVideoStopped ? "Turn camera on" : "Turn camera off"}
                        >
                            {isVideoStopped ? "Cam Off" : "Cam On"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CameraFeed;
