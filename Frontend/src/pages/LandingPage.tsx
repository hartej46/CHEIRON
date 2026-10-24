import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import { initPlayer } from "../service/service";
import { useNickname } from "../context/NicknameContext";
import { ProfileModal } from "../components/ProfileModal";

interface LandingPageProps {
    onStart: (nickname: string) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
    const {
        nickname: contextNickname,
        userData,
        isLoggedIn,
        setNickname: setContextNickname,
    } = useNickname();

    const activeName = contextNickname || userData?.nickname || "";
    const [userTypedNickname, setUserTypedNickname] = useState<string | null>(null);
    const nicknameInput = userTypedNickname !== null ? userTypedNickname : activeName;

    const [isProfileOpen, setIsProfileOpen] = useState(false);
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
        const trimmedNickname = nicknameInput.trim();

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

        // 4. If user is already logged in with this exact nickname, continue directly!
        const existingName = userData?.nickname || contextNickname;
        if (isLoggedIn && existingName && existingName === trimmedNickname) {
            onStart(trimmedNickname);
            return;
        }

        // 5. Submit session initiation/update request to backend
        try {
            setIsSubmitting(true);
            setApiError(null);
            setValidationError(null);
            await initPlayer(trimmedNickname);
            setContextNickname(trimmedNickname);
            onStart(trimmedNickname);
        } catch (error) {
            setApiError(
                error instanceof Error ? error.message : "Unable to connect to server."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeUserDisplayName =
        userData?.nickname || contextNickname || (isLoggedIn ? "Guest" : null);

    return (
        <div className="landing-layout">
            {/* Top Navigation Bar with Logo and Top-Right Profile Section */}
            <header className="landing-top-bar">
                <div className="brand-logo-group">
                    <span className="brand-title">CHEIRON</span>
                    <span className="brand-divider">/</span>
                    <span className="brand-subtitle">minimalist video</span>
                </div>

                <div className="top-bar-right">
                    <button
                        type="button"
                        onClick={() => setIsProfileOpen(true)}
                        className="profile-top-button"
                        title={
                            isLoggedIn && activeUserDisplayName
                                ? `Profile: ${activeUserDisplayName}`
                                : "View Profile"
                        }
                        aria-label="Open user profile"
                    >
                        <span
                            className={`profile-status-dot ${isLoggedIn ? "active" : "idle"}`}
                        />
                        <span className="profile-top-nickname">
                            {isLoggedIn && activeUserDisplayName
                                ? activeUserDisplayName
                                : "Profile"}
                        </span>
                        <svg
                            className="profile-icon"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                        >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </button>
                </div>
            </header>

            <main className="landing-page">
                <section className="landing-card" aria-labelledby="landing-title">
                    <p className="eyebrow">CHEIRON / VIDEO CHAT</p>
                    <h1 id="landing-title">
                        {isLoggedIn && activeUserDisplayName
                            ? `Welcome, ${activeUserDisplayName}.`
                            : "Talk to someone new."}
                    </h1>

                    <p className="landing-copy">
                        {isLoggedIn && activeUserDisplayName
                            ? "Your session is active. Enable camera and microphone to continue chatting."
                            : "Camera and microphone access are required before entering the room."}
                    </p>

                    {/* Active session continuity badge if logged in */}
                    {isLoggedIn && activeUserDisplayName && (
                        <div className="session-continuity-pill">
                            <div className="continuity-status">
                                <span className="pulse-dot green" />
                                <span>
                                    Continuing as <strong>{activeUserDisplayName}</strong>
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsProfileOpen(true)}
                                className="continuity-profile-link"
                            >
                                Manage Profile
                            </button>
                        </div>
                    )}

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
                                    <span className="permission-icon" aria-hidden="true">
                                        📹
                                    </span>
                                    <span className="permission-icon" aria-hidden="true">
                                        🎙️
                                    </span>
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
                        <label htmlFor="nickname">
                            {isLoggedIn ? "Nickname (Editable)" : "Nickname"}
                        </label>
                        <input
                            id="nickname"
                            name="nickname"
                            type="text"
                            value={nicknameInput}
                            onChange={(event) => {
                                setUserTypedNickname(event.target.value);
                                setValidationError(null);
                                setApiError(null);
                            }}
                            placeholder="Enter your nickname"
                            autoComplete="nickname"
                            autoFocus={!isLoggedIn}
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
                            {isSubmitting
                                ? "Starting..."
                                : isLoggedIn
                                  ? "Continue to Video Chat"
                                  : "Start Chatting"}
                        </button>
                    </form>
                </section>
            </main>

            {/* Profile Modal */}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
            />
        </div>
    );
}

