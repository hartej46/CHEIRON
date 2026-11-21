import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
    Activity,
    ArrowRight,
    Check,
    Circle,
    Cpu,
    Hand,
    Mic,
    Radio,
    RefreshCw,
    Scissors,
    Shield,
    Sparkles,
    Swords,
    User,
    Video,
    Zap,
} from "lucide-react";
import { checkBackendHealth, initPlayer } from "../service/service";
import { useNickname } from "../context/NicknameContext";
import { ProfileModal } from "../components/ProfileModal";
import "../styles/landing.css";

interface LandingPageProps {
    onStart: (nickname: string) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
    const {
        nickname: contextNickname,
        userData,
        isLoggedIn,
        setNickname: setContextNickname,
        setUserData,
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
    const [backendHealth, setBackendHealth] = useState<"checking" | "waking" | "ready">("checking");
    const [hasRecoveredFromWaking, setHasRecoveredFromWaking] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Initial and periodic health check for backend cold-start on Render
    useEffect(() => {
        let isMounted = true;
        let pollTimer: ReturnType<typeof setInterval> | null = null;

        const checkHealth = async () => {
            const isHealthy = await checkBackendHealth();
            if (!isMounted) return;

            if (isHealthy) {
                setBackendHealth((prev) => {
                    if (prev === "waking") {
                        setHasRecoveredFromWaking(true);
                    }
                    return "ready";
                });
                if (pollTimer) {
                    clearInterval(pollTimer);
                    pollTimer = null;
                }
            } else {
                setBackendHealth("waking");
                if (!pollTimer) {
                    pollTimer = setInterval(async () => {
                        const ok = await checkBackendHealth();
                        if (!isMounted) return;
                        if (ok) {
                            setBackendHealth("ready");
                            setHasRecoveredFromWaking(true);
                            if (pollTimer) {
                                clearInterval(pollTimer);
                                pollTimer = null;
                            }
                        }
                    }, 3000);
                }
            }
        };

        checkHealth();

        return () => {
            isMounted = false;
            if (pollTimer) clearInterval(pollTimer);
        };
    }, []);

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
            setValidationError("Please enter a callsign to continue.");
            return;
        }

        if (trimmedNickname.length <= 2) {
            setValidationError("Callsign must be greater than 2 characters.");
            return;
        }

        // 2. Strict JS Permission Check
        let isPermitted = permissionStatus === "granted" && previewStream !== null;
        if (!isPermitted) {
            isPermitted = await requestMediaPermissions();
        }

        // If permission was not given, do not allow entering
        if (!isPermitted) {
            return;
        }

        // 3. Stop preview stream so tracks are freed for the video room
        previewStream?.getTracks().forEach((track) => track.stop());
        setPreviewStream(null);

        // 4. Submit session initiation/update request to backend
        try {
            setIsSubmitting(true);
            setApiError(null);
            setValidationError(null);

            // If backend is waking up on Render, verify readiness before proceeding
            if (backendHealth === "waking") {
                const isNowReady = await checkBackendHealth();
                if (!isNowReady) {
                    setIsSubmitting(false);
                    setApiError(
                        "Backend is still turning on on Render (~30-50s cold start). Please wait a few seconds and try again."
                    );
                    return;
                }
                setBackendHealth("ready");
                setHasRecoveredFromWaking(true);
            }

            const response = await initPlayer(trimmedNickname);
            if (response?.profile) {
                setUserData(response.profile);
            }
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

    const reveal: Variants = {
        hidden: { opacity: 0, y: 16 },
        visible: (index = 0) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: index * 0.07,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1] as const,
            },
        }),
    };

    return (
        <main className="cheiron-landing">
            {/* Ambient Background Layers */}
            <div className="landing-ambient-layer" aria-hidden="true" />
            <div className="landing-grid-layer" aria-hidden="true" />

            {/* Left Hero Column: "The Neural Arena" */}
            <section className="landing-hero-col" aria-labelledby="hero-title">
                {/* Header */}
                <motion.header
                    className="landing-hero-header"
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                >
                    <div className="landing-brand-group">
                        <span className="landing-brand-title">CHEIRON</span>
                        <span
                            className={`landing-online-tag ${
                                backendHealth === "ready" ? "ready" : "waking"
                            }`}
                        >
                            <span
                                className={`landing-online-dot ${
                                    backendHealth === "ready" ? "" : "waking"
                                }`}
                            />
                            <span>
                                {backendHealth === "ready"
                                    ? "Backend Online"
                                    : backendHealth === "waking"
                                      ? "Backend Waking Up..."
                                      : "Connecting Server..."}
                            </span>
                        </span>
                    </div>
                    <span className="landing-hero-version">v2.4 / P2P Vision</span>
                </motion.header>

                {/* Hero Body */}
                <div className="landing-hero-body">
                    <motion.div
                        className="landing-kicker-pill"
                        variants={reveal}
                        custom={0}
                        initial="hidden"
                        animate="visible"
                    >
                        <Zap size={12} strokeWidth={2.4} />
                        <span>Real-Time 3D Gesture Duels</span>
                    </motion.div>

                    <motion.h1
                        id="hero-title"
                        className="landing-hero-headline"
                        variants={reveal}
                        custom={1}
                        initial="hidden"
                        animate="visible"
                    >
                        <span className="gradient-word">Rock.</span>
                        <br />
                        <span className="gradient-word">Paper.</span>
                        <br />
                        <span className="gradient-word">Scissors.</span>
                    </motion.h1>

                    <motion.p
                        className="landing-hero-subtitle"
                        variants={reveal}
                        custom={2}
                        initial="hidden"
                        animate="visible"
                    >
                        Step in front of your camera. Battle live strangers with{" "}
                        <strong>21-landmark neural hand tracking</strong> and dynamic animated 3D
                        clash physics. No controllers needed.
                    </motion.p>

                    {/* 3 Interactive Holographic Gesture Cards */}
                    <div className="landing-gesture-deck" aria-label="Game moves preview">
                        {[
                            {
                                key: "rock",
                                label: "Rock",
                                rule: "Crushes Scissors",
                                icon: Circle,
                                cls: "card-rock",
                            },
                            {
                                key: "paper",
                                label: "Paper",
                                rule: "Covers Rock",
                                icon: Hand,
                                cls: "card-paper",
                            },
                            {
                                key: "scissors",
                                label: "Scissors",
                                rule: "Cuts Paper",
                                icon: Scissors,
                                cls: "card-scissors",
                            },
                        ].map(({ key, label, rule, icon: Icon, cls }, idx) => (
                            <motion.div
                                key={key}
                                className={`gesture-card ${cls}`}
                                initial={{ opacity: 0, y: 18 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    delay: 0.28 + idx * 0.1,
                                    duration: 0.45,
                                    ease: "easeOut",
                                }}
                            >
                                <div className="gesture-icon-wrap">
                                    <Icon size={24} strokeWidth={1.8} />
                                </div>
                                <span className="gesture-name">{label}</span>
                                <span className="gesture-rule">{rule}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Hero Footer Specifications */}
                <motion.footer
                    className="landing-hero-footer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                >
                    <div className="landing-spec-pill">
                        <Radio size={14} />
                        <span>WebRTC Peer-to-Peer</span>
                    </div>
                    <span className="landing-spec-divider">/</span>
                    <div className="landing-spec-pill">
                        <Cpu size={14} />
                        <span>MediaPipe Vision AI</span>
                    </div>
                    <span className="landing-spec-divider">/</span>
                    <div className="landing-spec-pill">
                        <Swords size={14} />
                        <span>Real-Time 3D Physics</span>
                    </div>
                </motion.footer>
            </section>

            {/* Right Column: "Pre-Flight Console" */}
            <section className="landing-console-col" aria-label="Pre-flight setup console">
                <motion.div
                    className="landing-console-card"
                    initial={{ opacity: 0, scale: 0.96, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                >
                    {/* Console Telemetry Top Bar */}
                    <div className="console-telemetry-bar">
                        <span className="console-tag">PRE-MATCH CALIBRATION</span>
                        <button
                            type="button"
                            onClick={() => setIsProfileOpen(true)}
                            className="console-profile-btn"
                            title={
                                isLoggedIn && activeUserDisplayName
                                    ? `Profile: ${activeUserDisplayName}`
                                    : "View Profile"
                            }
                            aria-label="Open user profile"
                        >
                            <span
                                className={`console-profile-dot ${
                                    isLoggedIn ? "is-active" : ""
                                }`}
                            />
                            <span>
                                {isLoggedIn && activeUserDisplayName
                                    ? activeUserDisplayName
                                    : "Profile"}
                            </span>
                        </button>
                    </div>

                    <h2 className="console-title">
                        {isLoggedIn && activeUserDisplayName
                            ? `Welcome, ${activeUserDisplayName}`
                            : "Enter the Arena"}
                    </h2>
                    <p className="console-subcopy">
                        Calibrate your camera and set your combat callsign to begin live
                        matchmaking.
                    </p>

                    {/* Cold start notification on Render free tier */}
                    <AnimatePresence>
                        {backendHealth === "waking" && (
                            <motion.div
                                className="console-warmup-banner"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.22 }}
                            >
                                <div className="warmup-spinner-wrap">
                                    <RefreshCw size={15} className="spin-slow" />
                                </div>
                                <div className="warmup-content">
                                    <strong>Backend is turning on on Render</strong>
                                    <p>
                                        Free instances sleep after inactivity. Waking up usually
                                        takes ~30 to 50 seconds. Reconnecting automatically...
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {backendHealth === "ready" && hasRecoveredFromWaking && (
                            <motion.div
                                className="console-warmup-ready-banner"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.22 }}
                            >
                                <Check size={14} strokeWidth={2.4} />
                                <span>Backend server is online and ready for combat!</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isLoggedIn && activeUserDisplayName && (
                        <div className="console-session-badge">
                            <Check size={14} strokeWidth={2.4} />
                            <span>
                                Active callsign: <strong>{activeUserDisplayName}</strong>
                            </span>
                        </div>
                    )}

                    {/* Diagnostics & Camera Viewfinder */}
                    <div
                        className={`console-diagnostics-box ${
                            permissionStatus === "granted" && previewStream
                                ? "is-granted"
                                : ""
                        }`}
                    >
                        <div className="console-diagnostics-header">
                            <div className="diagnostics-label-group">
                                <span className="diagnostics-icon">
                                    <Video size={15} />
                                    <Mic size={15} style={{ marginLeft: 3 }} />
                                </span>
                                <span className="diagnostics-title">Sensors & Hardware</span>
                            </div>
                            <span className={`diagnostics-chip ${permissionStatus}`}>
                                {permissionStatus === "granted"
                                    ? "Online"
                                    : permissionStatus === "requesting"
                                      ? "Verifying..."
                                      : permissionStatus === "denied"
                                        ? "Denied"
                                        : "Standby"}
                            </span>
                        </div>

                        {permissionStatus === "granted" && previewStream ? (
                            <div className="console-preview-wrap">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="console-preview-video"
                                    aria-label="Live camera preview"
                                />
                                {/* Cybernetic HUD Brackets */}
                                <span className="console-hud-bracket top-left" aria-hidden="true" />
                                <span className="console-hud-bracket top-right" aria-hidden="true" />
                                <span className="console-hud-bracket bottom-left" aria-hidden="true" />
                                <span className="console-hud-bracket bottom-right" aria-hidden="true" />
                                <div className="console-preview-live-tag">
                                    <span className="landing-online-dot" />
                                    <span>Vision Sensor Active</span>
                                </div>
                            </div>
                        ) : (
                            <div className="console-permission-prompt">
                                <p className="permission-prompt-sub">
                                    {permissionStatus === "denied"
                                        ? "Camera or microphone permissions are blocked. Allow access in your browser to proceed."
                                        : "Grant camera and microphone permissions so Cheiron can track your gestures during duels."}
                                </p>
                                <button
                                    type="button"
                                    onClick={requestMediaPermissions}
                                    disabled={permissionStatus === "requesting"}
                                    className="console-calibrate-btn"
                                >
                                    <Sparkles size={14} />
                                    <span>
                                        {permissionStatus === "requesting"
                                            ? "Requesting Access..."
                                            : permissionStatus === "denied"
                                              ? "Retry Hardware Check"
                                              : "Calibrate Camera & Mic"}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    <AnimatePresence initial={false}>
                        {mediaError && (
                            <motion.p
                                className="console-field-error"
                                role="alert"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                            >
                                {mediaError}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* Player Nickname / Callsign Form */}
                    <form onSubmit={handleSubmit} className="console-form">
                        <div className="console-input-group">
                            <label htmlFor="nickname" className="console-input-label">
                                <span>{isLoggedIn ? "Combat Callsign" : "Choose Callsign"}</span>
                                <span style={{ color: "var(--landing-dim)" }}>
                                    {nicknameInput.length} / 20
                                </span>
                            </label>

                            <div className="console-input-wrap">
                                <span className="console-input-icon">
                                    <User size={16} />
                                </span>
                                <input
                                    id="nickname"
                                    name="nickname"
                                    type="text"
                                    maxLength={20}
                                    value={nicknameInput}
                                    onChange={(event) => {
                                        setUserTypedNickname(event.target.value);
                                        setValidationError(null);
                                        setApiError(null);
                                    }}
                                    placeholder="e.g. Phoenix, Cipher, Nova"
                                    className="console-text-input"
                                    autoComplete="nickname"
                                    autoFocus={!isLoggedIn}
                                    aria-invalid={Boolean(validationError)}
                                />
                            </div>

                            {validationError && (
                                <p className="console-field-error" role="alert">
                                    {validationError}
                                </p>
                            )}
                            {apiError && (
                                <p className="console-field-error" role="alert">
                                    {apiError}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="console-enter-btn"
                            disabled={isSubmitting || permissionStatus === "requesting"}
                        >
                            <span>
                                {isSubmitting
                                    ? "Initializing Session..."
                                    : isLoggedIn
                                      ? "Enter The Arena"
                                      : "Find Opponent"}
                            </span>
                            <ArrowRight size={17} strokeWidth={2.4} />
                        </button>
                    </form>
                </motion.div>
            </section>

            {/* Profile Management Modal */}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
            />
        </main>
    );
}
