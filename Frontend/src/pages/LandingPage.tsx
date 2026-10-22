import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import { initPlayer } from "../service/service";

interface LandingPageProps {
    onStart: (nickname: string) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
    const [nickname, setNickname] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<
        "prompt" | "requesting" | "granted" | "denied"
    >("prompt");
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Update video element when previewStream is available
    useEffect(() => {
        if (videoRef.current && previewStream) {
            videoRef.current.srcObject = previewStream;
        }
    }, [previewStream]);

    // Clean up preview stream on unmount
    useEffect(() => {
        return () => {
            previewStream?.getTracks().forEach((track) => track.stop());
        };
    }, [previewStream]);

    const requestMediaPermissions = async (): Promise<boolean> => {
        setMediaError(null);
        setPermissionStatus("requesting");

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setPermissionStatus("denied");
            setMediaError(
                "Your browser does not support camera and microphone access. Please use Chrome, Safari, or Firefox."
            );
            return false;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setPreviewStream(stream);
            setPermissionStatus("granted");
            setMediaError(null);
            return true;
        } catch (error: unknown) {
            setPermissionStatus("denied");
            if (previewStream) {
                previewStream.getTracks().forEach((t) => t.stop());
                setPreviewStream(null);
            }
            const errName = (error as { name?: string })?.name;
            if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
                setMediaError(
                    "Camera and microphone permissions were denied. Please allow them in your browser settings to continue."
                );
            } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
                setMediaError(
                    "No camera or microphone found. Please connect your devices and try again."
                );
            } else {
                setMediaError(
                    "Camera and microphone access is required to enter. Please grant permission."
                );
            }
            return false;
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedNickname = nickname.trim();

        // 1. Validate username on frontend
        if (!trimmedNickname) {
            setValidationError("Please enter a username to continue.");
            return;
        }

        if (trimmedNickname.length <= 2) {
            setValidationError("Username must be greater than 2 characters.");
            return;
        }

        // 2. Strict JS Permission Check
        let isPermitted = permissionStatus === "granted" && previewStream !== null;
        if (!isPermitted) {
            isPermitted = await requestMediaPermissions();
        }

        // If permission was not given, do not allow entering!
        if (!isPermitted) {
            return;
        }

        // 3. Stop preview stream so tracks are freed for the video room
        previewStream?.getTracks().forEach((track) => track.stop());
        setPreviewStream(null);

        // 4. Submit session initiation request to backend
        try {
            setIsSubmitting(true);
            setApiError(null);
            setValidationError(null);
            await initPlayer(trimmedNickname);
            onStart(trimmedNickname);
        } catch (error) {
            setApiError(
                error instanceof Error ? error.message : "Unable to connect to server."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="landing-page">
            <section className="landing-card" aria-labelledby="landing-title">
                <p className="eyebrow">CHEIRON / VIDEO CHAT</p>
                <h1 id="landing-title">Talk to someone new.</h1>
                <p className="landing-copy">
                    Camera and microphone access are required before entering the room.
                </p>

                {/* Media Permission Status & Preview */}
                <div className="permission-card">
                    {permissionStatus === "granted" && previewStream ? (
                        <div className="preview-container">
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="preview-video"
                                aria-label="Camera preview"
                            />
                            <div className="preview-badge success">
                                <span className="pulse-dot green" />
                                Camera & Mic Active
                            </div>
                        </div>
                    ) : (
                        <div className="permission-prompt-box">
                            <div className="permission-icon-row">
                                <span className="permission-icon" aria-hidden="true">📹</span>
                                <span className="permission-icon" aria-hidden="true">🎙️</span>
                            </div>
                            <p className="permission-text">
                                {permissionStatus === "denied"
                                    ? "Permissions blocked. Please allow camera and microphone in your browser to enter."
                                    : "Grant camera & microphone permission to test your setup before entering."}
                            </p>
                            <button
                                type="button"
                                onClick={requestMediaPermissions}
                                disabled={permissionStatus === "requesting"}
                                className="permission-button"
                            >
                                {permissionStatus === "requesting"
                                    ? "Requesting Access..."
                                    : permissionStatus === "denied"
                                      ? "Try Again"
                                      : "Enable Camera & Mic"}
                            </button>
                        </div>
                    )}
                </div>

                {mediaError && (
                    <p className="form-error media-block-error" role="alert">
                        {mediaError}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="nickname-form">
                    <label htmlFor="nickname">Nickname</label>
                    <input
                        id="nickname"
                        name="nickname"
                        type="text"
                        value={nickname}
                        onChange={(event) => {
                            setNickname(event.target.value);
                            setValidationError(null);
                            setApiError(null);
                        }}
                        placeholder="Enter your nickname"
                        autoComplete="nickname"
                        autoFocus
                        aria-invalid={Boolean(validationError)}
                        aria-describedby={
                            validationError
                                ? "nickname-error"
                                : apiError
                                  ? "nickname-api-error"
                                  : undefined
                        }
                    />
                    {validationError && (
                        <p id="nickname-error" className="form-error" role="alert">
                            {validationError}
                        </p>
                    )}
                    {apiError && (
                        <p id="nickname-api-error" className="form-error" role="alert">
                            {apiError}
                        </p>
                    )}
                    <button
                        type="submit"
                        className="primary-button"
                        disabled={isSubmitting || permissionStatus === "requesting"}
                    >
                        {isSubmitting ? "Starting..." : "Start Chatting"}
                    </button>
                </form>
            </section>
        </main>
    );
}
