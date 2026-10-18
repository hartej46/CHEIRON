import React from "react";
import type { MatchStatus } from "./RemoteScreen";

interface ControlBarProps {
    status: MatchStatus;
    isCameraActive: boolean;
    isMuted: boolean;
    isVideoStopped: boolean;
    onGetStarted: () => void;
    onNext: () => void;
    onStop: () => void;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    onStartCamera: () => Promise<void>;
    onStopCamera?: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
    status,
    isCameraActive,
    isMuted,
    isVideoStopped,
    onGetStarted,
    onNext,
    onStop,
    onToggleMute,
    onToggleVideo,
    onStartCamera,
    onStopCamera,
}) => {
    return (
        <section className="minimal-control-bar" aria-label="Controls">
            <div className="control-left-group">
                {status === "idle" && (
                    <button
                        type="button"
                        onClick={onGetStarted}
                        className="btn-minimal btn-minimal-primary btn-large"
                    >
                        Get Started
                    </button>
                )}

                {status === "searching" && (
                    <button
                        type="button"
                        onClick={onStop}
                        className="btn-minimal btn-minimal-secondary btn-large"
                    >
                        Stop Searching
                    </button>
                )}

                {status === "connected" && (
                    <>
                        <button
                            type="button"
                            onClick={onNext}
                            className="btn-minimal btn-minimal-primary btn-large"
                        >
                            Next Partner
                        </button>
                        <button
                            type="button"
                            onClick={onStop}
                            className="btn-minimal btn-minimal-danger btn-large"
                        >
                            Leave Chat
                        </button>
                    </>
                )}

                {status === "disconnected" && (
                    <button
                        type="button"
                        onClick={onNext}
                        className="btn-minimal btn-minimal-primary btn-large"
                    >
                        Next
                    </button>
                )}
            </div>

            <div className="control-right-group">
                {!isCameraActive ? (
                    <button
                        type="button"
                        onClick={onStartCamera}
                        className="btn-minimal btn-minimal-secondary"
                    >
                        Enable Camera
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={onToggleMute}
                            className={`btn-minimal ${isMuted ? "btn-minimal-active" : "btn-minimal-secondary"}`}
                        >
                            {isMuted ? "Unmute Mic" : "Mute Mic"}
                        </button>
                        <button
                            type="button"
                            onClick={onToggleVideo}
                            className={`btn-minimal ${isVideoStopped ? "btn-minimal-active" : "btn-minimal-secondary"}`}
                        >
                            {isVideoStopped ? "Enable Cam" : "Disable Cam"}
                        </button>
                        {onStopCamera && (
                            <button
                                type="button"
                                onClick={onStopCamera}
                                className="btn-minimal btn-minimal-secondary"
                                title="Turn off camera and release device"
                            >
                                Release Cam
                            </button>
                        )}
                    </>
                )}
            </div>
        </section>
    );
};

export default ControlBar;
