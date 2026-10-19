import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNickname } from "../context/NicknameContext";

export function VideoRoom() {
    const { nickname } = useNickname();
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [hasStream, setHasStream] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((track) => track.stop());
        };
    }, []);

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

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setCameraEnabled(true);
            setAudioEnabled(stream.getAudioTracks().some((track) => track.enabled));
            // TODO: Publish the local stream to the WebRTC peer connection.
        } catch {
            setMediaError(
                "Camera or microphone access was denied. Check your browser permissions."
            );
        }
    };

    const disableCamera = () => {
        streamRef.current?.getVideoTracks().forEach((track) => track.stop());
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraEnabled(false);
        // TODO: Notify the backend that the local video track is unavailable.
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
                        <span>Waiting for connection...</span>
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
