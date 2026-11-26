import { useState, useRef, useEffect, useCallback } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowRight,
    Camera,
    Check,
    Circle,
    Hand,
    RefreshCw,
    Scissors,
    User,
    Video,
} from "lucide-react";
import { checkBackendHealth, initPlayer } from "../service/service";
import { useNickname } from "../context/NicknameContext";
import { useTheme } from "../context/ThemeContext";
import { ProfileModal } from "../components/ProfileModal";
import {
    SculptedHandSVG,
    type NormalizedMove,
} from "../components/DuelClashStage";
import {
    SketchArenaDoodles,
    SketchButton,
    SketchDivider,
    SketchSquiggleUnderline,
    SketchSurface,
    ThemeToggleButton,
} from "../components/SketchPrimitives";
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
    const { isDark } = useTheme();

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
    const simTimerRef = useRef<number | null>(null);

    // Interactive Duel Simulator State
    const [simUserMove, setSimUserMove] = useState<NormalizedMove>("rock");
    const [simOppMove, setSimOppMove] = useState<NormalizedMove>("scissors");
    const [simWinner, setSimWinner] = useState<"user" | "opponent" | "draw">("user");
    const [simStatusText, setSimStatusText] = useState("you win!");
    const [simScore, setSimScore] = useState({ user: 2, opponent: 1 });
    const [simIsAnimating, setSimIsAnimating] = useState(false);
    const [simClashKey, setSimClashKey] = useState(1);

    // Theme-aware surface tokens for hand-drawn SketchSurface panels
    const cardSurfaceFill = isDark ? "#1C1C21" : "#FFFFFF";
    const subCardFill = isDark ? "#24242B" : "#FAFADF";
    const inputSurfaceFill = isDark ? "#151519" : "#FFFFFF";
    const simStageFill = isDark ? "#151519" : "#FAFADF";
    const simLeftPodFill = isDark ? "#1F1D2A" : "#FFF8EE";
    const simRightPodFill = isDark ? "#211B27" : "#F5F1FF";

    // Poll backend health status
    useEffect(() => {
        let isMounted = true;
        let pollTimer: ReturnType<typeof setInterval> | null = null;

        const checkHealth = async () => {
            const ok = await checkBackendHealth();
            if (!isMounted) return;
            if (ok) {
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
                        const okRetry = await checkBackendHealth();
                        if (!isMounted) return;
                        if (okRetry) {
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

    // Clean up preview stream and simulator timers on unmount
    useEffect(() => {
        return () => {
            previewStream?.getTracks().forEach((track) => track.stop());
            if (simTimerRef.current !== null) {
                window.clearTimeout(simTimerRef.current);
            }
        };
    }, [previewStream]);

    // Interactive Move Simulator Handler
    const handleSimulateMove = useCallback(
        (chosenMove: NormalizedMove) => {
            if (simIsAnimating) return;

            const possibleMoves: NormalizedMove[] = ["rock", "paper", "scissors"];
            const randomOpp = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

            let winner: "user" | "opponent" | "draw" = "draw";
            let status = "round tied!";

            if (chosenMove === randomOpp) {
                winner = "draw";
                status = "round tied!";
            } else if (
                (chosenMove === "rock" && randomOpp === "scissors") ||
                (chosenMove === "paper" && randomOpp === "rock") ||
                (chosenMove === "scissors" && randomOpp === "paper")
            ) {
                winner = "user";
                status = "you win!";
            } else {
                winner = "opponent";
                status = "opponent wins!";
            }

            setSimUserMove(chosenMove);
            setSimOppMove(randomOpp);
            setSimWinner(winner);
            setSimStatusText(status);
            setSimClashKey((k) => k + 1);
            setSimIsAnimating(true);

            if (winner === "user") {
                setSimScore((s) => ({ ...s, user: s.user + 1 }));
            } else if (winner === "opponent") {
                setSimScore((s) => ({ ...s, opponent: s.opponent + 1 }));
            }

            if (simTimerRef.current !== null) {
                window.clearTimeout(simTimerRef.current);
            }
            simTimerRef.current = window.setTimeout(() => {
                setSimIsAnimating(false);
            }, 950);
        },
        [simIsAnimating]
    );

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
            setValidationError("Please enter your name to continue.");
            return;
        }

        if (trimmedNickname.length <= 2) {
            setValidationError("Name must be greater than 2 characters.");
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

            if (backendHealth === "waking") {
                const isNowReady = await checkBackendHealth();
                if (!isNowReady) {
                    setIsSubmitting(false);
                    setApiError("Connecting to server. Please wait a moment and try again.");
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
            setApiError(error instanceof Error ? error.message : "Unable to connect to server.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeUserDisplayName =
        userData?.nickname || contextNickname || (isLoggedIn ? "player" : null);

    const outcomeFill =
        simWinner === "user"
            ? "#4ECDC4"
            : simWinner === "opponent"
              ? "#F9A8B8"
              : "#FFE566";

    const hwPillFill =
        permissionStatus === "granted"
            ? "#4ECDC4"
            : permissionStatus === "requesting"
              ? "#FFE566"
              : permissionStatus === "denied"
                ? "#E8635A"
                : subCardFill;

    return (
        <main className="cheiron-landing">
            {/* Sketchbook Texture + Floating Hand-Drawn Doodles */}
            <div className="landing-paper-dots" aria-hidden="true" />
            <div className="landing-doodles-layer" aria-hidden="true">
                <SketchArenaDoodles variant="landing" />
            </div>

            {/* Top Navigation Bar */}
            <header className="landing-top-bar">
                <div className="landing-brand-wrap">
                    <SketchSurface
                        as="div"
                        fill="#FFE566"
                        onPastel={true}
                        shadow={3}
                        radius={16}
                        seed="landing-brand"
                        bow={1.4}
                        doubleStroke={true}
                        innerClassName="landing-brand-inner"
                    >
                        <span className="landing-brand-ring" aria-hidden="true" />
                        <span className="landing-brand-name">cheiron</span>
                    </SketchSurface>
                </div>

                <div className="landing-header-right">
                    <button
                        type="button"
                        className={`landing-status-dot-btn ${
                            backendHealth === "ready" ? "is-ready" : "is-waking"
                        }`}
                        data-tooltip={
                            backendHealth === "ready" ? "server online" : "connecting to server..."
                        }
                        title={
                            backendHealth === "ready" ? "server online" : "connecting to server..."
                        }
                        aria-label={
                            backendHealth === "ready" ? "Server online" : "Connecting to server"
                        }
                    >
                        <span className="status-indicator-dot" />
                    </button>

                    <ThemeToggleButton seed="landing-theme-toggle" iconOnly={true} />

                    <SketchButton
                        type="button"
                        onClick={() => setIsProfileOpen(true)}
                        fill="#C4B5FD"
                        onPastel={true}
                        shadow={3}
                        radius={16}
                        seed="landing-profile-btn"
                        aria-label="Open Profile"
                        faceClassName="landing-profile-face"
                    >
                        <User size={15} strokeWidth={2.4} />
                        <span>{activeUserDisplayName || "profile"}</span>
                    </SketchButton>
                </div>
            </header>

            {/* Primary Two-Column Hero Workspace */}
            <div className="landing-hero-grid">
                {/* Left Column: Setup Form & Camera Diagnostics */}
                <section className="landing-setup-col">
                    <h1 className="landing-headline">
                        <span className="landing-headline-primary">rock. paper. scissors.</span>
                        <span className="landing-headline-secondary">
                            your hands.{" "}
                            <span className="landing-headline-accent">
                                your game.
                                <SketchSquiggleUnderline color="#E8635A" />
                            </span>
                        </span>
                    </h1>

                    <p className="landing-subcopy">
                        challenge real players using your camera and hand gestures.
                    </p>

                    {/* Server Health Banner */}
                    <AnimatePresence mode="wait">
                        {backendHealth === "waking" && (
                            <motion.div
                                key="waking-banner"
                                className="landing-banner-wrap"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.22 }}
                            >
                                <SketchSurface
                                    fill="#FFE566"
                                    onPastel={true}
                                    shadow={3}
                                    radius={16}
                                    seed="landing-waking-banner"
                                    innerClassName="landing-notice-inner"
                                >
                                    <RefreshCw size={15} strokeWidth={2.4} className="spin-icon" />
                                    <div className="notice-copy">
                                        <strong>connecting to duel server</strong>
                                        <span>establishing session endpoint automatically...</span>
                                    </div>
                                </SketchSurface>
                            </motion.div>
                        )}

                        {backendHealth === "ready" && hasRecoveredFromWaking && (
                            <motion.div
                                key="ready-banner"
                                className="landing-banner-wrap"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.22 }}
                            >
                                <SketchSurface
                                    fill="#4ECDC4"
                                    onPastel={true}
                                    shadow={3}
                                    radius={16}
                                    seed="landing-ready-banner"
                                    innerClassName="landing-notice-inner"
                                >
                                    <Check size={15} strokeWidth={2.8} />
                                    <div className="notice-copy">
                                        <strong>server online</strong>
                                        <span>ready to pair you for live hand duels.</span>
                                    </div>
                                </SketchSurface>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Pre-Match Setup Card */}
                    <SketchSurface
                        as="div"
                        fill={cardSurfaceFill}
                        shadow={5}
                        radius={22}
                        seed="landing-setup-card"
                        bow={1.6}
                        doubleStroke={true}
                        className="landing-setup-card-wrap"
                        innerClassName="landing-setup-card-inner"
                    >
                        <form onSubmit={handleSubmit} className="landing-setup-form">
                            {/* Name Input */}
                            <div className="landing-field-group">
                                <label htmlFor="nickname" className="landing-field-label">
                                    <span>nickname</span>
                                    {nicknameInput.length > 0 && (
                                        <span className="char-count">{nicknameInput.length} / 20</span>
                                    )}
                                </label>

                                <SketchSurface
                                    as="div"
                                    fill={inputSurfaceFill}
                                    shadow={3}
                                    radius={14}
                                    seed="landing-name-input"
                                    bow={1.1}
                                    className="landing-input-surface"
                                    innerClassName="landing-input-inner"
                                >
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
                                        placeholder="enter your nickname"
                                        className="landing-text-input"
                                        autoComplete="off"
                                        autoFocus={!isLoggedIn}
                                        aria-invalid={Boolean(validationError)}
                                    />
                                </SketchSurface>

                                {validationError && (
                                    <p className="landing-error-text" role="alert">
                                        {validationError}
                                    </p>
                                )}
                                {apiError && (
                                    <p className="landing-error-text" role="alert">
                                        {apiError}
                                    </p>
                                )}
                            </div>

                            {/* Camera & Microphone Diagnostic Preview (flat, no nested box) */}
                            <div className="landing-hardware-section">
                                <div className="hardware-box-header">
                                    <div className="hardware-title-row">
                                        <Camera size={15} strokeWidth={2.4} />
                                        <span>camera &amp; mic</span>
                                    </div>
                                    {permissionStatus !== "prompt" && (
                                        <SketchSurface
                                            as="span"
                                            fill={hwPillFill}
                                            onPastel={true}
                                            shadow={2}
                                            radius={999}
                                            seed="landing-hw-status"
                                            innerClassName={`hardware-status-inner ${permissionStatus}`}
                                        >
                                            {permissionStatus === "granted"
                                                ? "connected"
                                                : permissionStatus === "requesting"
                                                  ? "checking..."
                                                  : "blocked"}
                                        </SketchSurface>
                                    )}
                                </div>

                                {permissionStatus === "granted" && previewStream ? (
                                    <div className="hardware-preview-viewport">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            muted
                                            playsInline
                                            className="hardware-video"
                                            aria-label="Local camera preview"
                                        />
                                        <span className="optical-crosshair ch-tl" aria-hidden="true" />
                                        <span className="optical-crosshair ch-tr" aria-hidden="true" />
                                        <span className="optical-crosshair ch-bl" aria-hidden="true" />
                                        <span className="optical-crosshair ch-br" aria-hidden="true" />
                                        <div className="hardware-ready-tag">
                                            <span className="ready-dot" />
                                            <span>camera ready</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="hardware-action-pane">
                                        <p className="hardware-prompt-desc">
                                            enable your camera to detect hand gestures.
                                        </p>
                                        <SketchButton
                                            type="button"
                                            onClick={requestMediaPermissions}
                                            disabled={permissionStatus === "requesting"}
                                            fill={subCardFill}
                                            shadow={2}
                                            radius={14}
                                            seed="landing-hw-trigger"
                                            className="hardware-trigger-root"
                                            faceClassName="hardware-trigger-face"
                                        >
                                            <Video size={14} strokeWidth={2.2} />
                                            <span>
                                                {permissionStatus === "requesting"
                                                    ? "connecting..."
                                                    : permissionStatus === "denied"
                                                      ? "retry camera & mic"
                                                      : "test camera & mic"}
                                            </span>
                                        </SketchButton>
                                    </div>
                                )}

                                {mediaError && (
                                    <p className="hardware-error-notice" role="alert">
                                        {mediaError}
                                    </p>
                                )}
                            </div>

                            {/* Submit CTA */}
                            <SketchButton
                                type="submit"
                                fill="#4ECDC4"
                                onPastel={true}
                                shadow={4}
                                radius={18}
                                seed="landing-submit-btn"
                                disabled={isSubmitting || permissionStatus === "requesting"}
                                className="landing-submit-btn-root"
                                faceClassName="landing-submit-face"
                            >
                                <span>
                                    {isSubmitting
                                        ? "entering matchmaking..."
                                        : isLoggedIn
                                          ? "find a match"
                                          : "start playing"}
                                </span>
                                <ArrowRight size={17} strokeWidth={2.6} />
                            </SketchButton>
                        </form>
                    </SketchSurface>
                </section>

                {/* Right Column: Live Interactive Match Simulator */}
                <section
                    className="landing-simulator-col"
                    aria-label="Live Preview"
                >
                    <div className="simulator-wrapper">
                        <div className="simulator-float-tag">
                            <SketchSurface
                                as="span"
                                fill="#FFE566"
                                onPastel={true}
                                shadow={2}
                                radius={999}
                                seed="sim-float-tag"
                                innerClassName="simulator-float-tag-inner"
                            >
                                live preview
                            </SketchSurface>
                        </div>

                        <SketchSurface
                            as="div"
                            fill={cardSurfaceFill}
                            shadow={6}
                            radius={24}
                            seed="landing-sim-card"
                            bow={1.8}
                            doubleStroke={true}
                            innerClassName="simulator-card-inner"
                        >
                            {/* Scoreboard */}
                            <SketchSurface
                                as="div"
                                fill={simStageFill}
                                shadow={3}
                                radius={18}
                                seed="landing-sim-score"
                                bow={1.2}
                                innerClassName="simulator-scoreboard-inner"
                            >
                                <div className="sim-player-side left">
                                    <span className="sim-player-name">
                                        {nicknameInput.trim() || "you"}
                                    </span>
                                    <span className="sim-score-num">{simScore.user}</span>
                                </div>

                                <div className="sim-score-divider">
                                    <span className="sim-round-label">round 3 of 5</span>
                                    <div className="sim-vs-row">
                                        <SketchDivider
                                            orientation="vertical"
                                            length={20}
                                            variant="zigzag"
                                            strokeWidth={2.2}
                                        />
                                        <span className="sim-vs-pill">vs</span>
                                    </div>
                                </div>

                                <div className="sim-player-side right">
                                    <span className="sim-score-num">{simScore.opponent}</span>
                                    <span className="sim-player-name">opponent</span>
                                </div>
                            </SketchSurface>

                            {/* Arena Stage */}
                            <SketchSurface
                                as="div"
                                fill={simStageFill}
                                shadow={3}
                                radius={20}
                                seed="landing-sim-stage"
                                bow={1.4}
                                innerClassName="simulator-stage-inner"
                            >
                                <div className="simulator-arena-stage">
                                    {/* Left Pod: Player Avatar / Live Feed */}
                                    <SketchSurface
                                        as="div"
                                        fill={simLeftPodFill}
                                        shadow={3}
                                        radius={16}
                                        seed="sim-pod-left"
                                        bow={1.2}
                                        className="sim-video-pod-root"
                                        innerClassName="sim-video-pod-inner"
                                    >
                                        {permissionStatus === "granted" && previewStream ? (
                                            <div className="sim-pod-viewport">
                                                <video
                                                    ref={(el) => {
                                                        if (
                                                            el &&
                                                            previewStream &&
                                                            el.srcObject !== previewStream
                                                        ) {
                                                            el.srcObject = previewStream;
                                                        }
                                                    }}
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    className="sim-pod-video"
                                                />
                                            </div>
                                        ) : (
                                            <div className="sim-pod-placeholder">
                                                <span className="sim-cam-corner tl" aria-hidden="true" />
                                                <span className="sim-cam-corner tr" aria-hidden="true" />
                                                <span className="sim-cam-corner bl" aria-hidden="true" />
                                                <span className="sim-cam-corner br" aria-hidden="true" />
                                                <div className="sim-cam-pill" aria-hidden="true">
                                                    <Camera size={11} strokeWidth={2.4} />
                                                </div>
                                                <div className="sim-avatar-circle you">
                                                    <User size={22} strokeWidth={2.4} />
                                                </div>
                                            </div>
                                        )}
                                    </SketchSurface>

                                    {/* Center Clash Stage */}
                                    <div className="sim-clash-center">
                                        <svg
                                            className="sim-clash-burst"
                                            viewBox="0 0 180 120"
                                            aria-hidden="true"
                                        >
                                            <path d="M 90 8 L 92 22 M 36 22 L 46 32 M 144 22 L 134 32 M 16 64 L 30 62 M 164 64 L 150 62 M 38 102 L 48 92 M 142 102 L 132 92" />
                                        </svg>

                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={simClashKey}
                                                className="sim-clash-hands"
                                                initial={{ opacity: 0, scale: 0.82, y: 8 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{ duration: 0.22, ease: "easeOut" }}
                                            >
                                                <motion.div
                                                    className="sim-hand-wrap left"
                                                    animate={
                                                        simWinner === "user"
                                                            ? {
                                                                  x: [0, 14, 3, 3],
                                                                  y: [0, -14, 0, -6, 0],
                                                                  scale: [0.9, 1.18, 1.03, 1.09, 1.03],
                                                                  rotate: [0, -7, 3, -2, 0],
                                                              }
                                                            : simWinner === "opponent"
                                                              ? {
                                                                    x: [0, -10],
                                                                    scale: [0.95, 0.84],
                                                                    opacity: [1, 0.55],
                                                                }
                                                              : { x: [0, 8, 0], y: [0, -5, 0] }
                                                    }
                                                    transition={{ duration: 0.65, ease: "easeOut" }}
                                                >
                                                    <SculptedHandSVG
                                                        move={simUserMove}
                                                        side="left"
                                                        role={
                                                            simWinner === "user"
                                                                ? "winner"
                                                                : simWinner === "opponent"
                                                                  ? "loser"
                                                                  : "draw"
                                                        }
                                                        uid={`sim-left-${simClashKey}`}
                                                    />
                                                </motion.div>

                                                <motion.div
                                                    className="sim-hand-wrap right"
                                                    animate={
                                                        simWinner === "opponent"
                                                            ? {
                                                                  x: [0, -14, -3, -3],
                                                                  y: [0, -14, 0, -6, 0],
                                                                  scale: [0.9, 1.18, 1.03, 1.09, 1.03],
                                                                  rotate: [0, 7, -3, 2, 0],
                                                              }
                                                            : simWinner === "user"
                                                              ? {
                                                                    x: [0, 10],
                                                                    scale: [0.95, 0.84],
                                                                    opacity: [1, 0.55],
                                                                }
                                                              : { x: [0, -8, 0], y: [0, -5, 0] }
                                                    }
                                                    transition={{ duration: 0.65, ease: "easeOut" }}
                                                >
                                                    <SculptedHandSVG
                                                        move={simOppMove}
                                                        side="right"
                                                        role={
                                                            simWinner === "opponent"
                                                                ? "winner"
                                                                : simWinner === "user"
                                                                  ? "loser"
                                                                  : "draw"
                                                        }
                                                        uid={`sim-right-${simClashKey}`}
                                                    />
                                                </motion.div>
                                            </motion.div>
                                        </AnimatePresence>

                                        <SketchSurface
                                            as="div"
                                            fill={outcomeFill}
                                            onPastel={true}
                                            shadow={2}
                                            radius={999}
                                            seed={`sim-outcome-${simWinner}`}
                                            innerClassName="sim-outcome-inner"
                                            aria-live="polite"
                                        >
                                            <span>{simStatusText}</span>
                                        </SketchSurface>
                                    </div>

                                    {/* Right Pod: Opponent Avatar */}
                                    <SketchSurface
                                        as="div"
                                        fill={simRightPodFill}
                                        shadow={3}
                                        radius={16}
                                        seed="sim-pod-right"
                                        bow={1.2}
                                        className="sim-video-pod-root"
                                        innerClassName="sim-video-pod-inner"
                                    >
                                        <div className="sim-pod-placeholder">
                                            <span className="sim-cam-corner tl" aria-hidden="true" />
                                            <span className="sim-cam-corner tr" aria-hidden="true" />
                                            <span className="sim-cam-corner bl" aria-hidden="true" />
                                            <span className="sim-cam-corner br" aria-hidden="true" />
                                            <div className="sim-cam-pill" aria-hidden="true">
                                                <Camera size={11} strokeWidth={2.4} />
                                            </div>
                                            <div className="sim-avatar-circle opponent">
                                                <User size={22} strokeWidth={2.4} />
                                            </div>
                                        </div>
                                    </SketchSurface>
                                </div>
                            </SketchSurface>

                            {/* Interactive Move Tester Bar */}
                            <div className="simulator-controls-bar">
                                <span className="controls-label">test a move:</span>
                                <div className="move-buttons-group">
                                    <SketchButton
                                        type="button"
                                        onClick={() => handleSimulateMove("rock")}
                                        disabled={simIsAnimating}
                                        fill="#C4B5FD"
                                        onPastel={true}
                                        shadow={3}
                                        radius={14}
                                        seed="sim-move-rock"
                                        strokeWidth={simUserMove === "rock" ? 3 : 2.3}
                                        faceClassName={`move-btn-face ${
                                            simUserMove === "rock" ? "is-selected" : ""
                                        }`}
                                        title="Throw Rock"
                                    >
                                        <Circle size={15} strokeWidth={2.4} />
                                        <span>rock</span>
                                    </SketchButton>

                                    <SketchButton
                                        type="button"
                                        onClick={() => handleSimulateMove("paper")}
                                        disabled={simIsAnimating}
                                        fill="#FFE566"
                                        onPastel={true}
                                        shadow={3}
                                        radius={14}
                                        seed="sim-move-paper"
                                        strokeWidth={simUserMove === "paper" ? 3 : 2.3}
                                        faceClassName={`move-btn-face ${
                                            simUserMove === "paper" ? "is-selected" : ""
                                        }`}
                                        title="Throw Paper"
                                    >
                                        <Hand size={15} strokeWidth={2.4} />
                                        <span>paper</span>
                                    </SketchButton>

                                    <SketchButton
                                        type="button"
                                        onClick={() => handleSimulateMove("scissors")}
                                        disabled={simIsAnimating}
                                        fill="#F9A8B8"
                                        onPastel={true}
                                        shadow={3}
                                        radius={14}
                                        seed="sim-move-scissors"
                                        strokeWidth={simUserMove === "scissors" ? 3 : 2.3}
                                        faceClassName={`move-btn-face ${
                                            simUserMove === "scissors" ? "is-selected" : ""
                                        }`}
                                        title="Throw Scissors"
                                    >
                                        <Scissors size={15} strokeWidth={2.4} />
                                        <span>scissors</span>
                                    </SketchButton>
                                </div>
                            </div>
                        </SketchSurface>
                    </div>
                </section>
            </div>

            {/* Profile Management Modal */}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                variant="neobrutal"
            />
        </main>
    );
}
