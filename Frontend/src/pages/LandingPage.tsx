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
import { ProfileModal } from "../components/ProfileModal";
import {
    SculptedHandSVG,
    type NormalizedMove,
} from "../components/DuelClashStage";
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

    // Interactive Duel Simulator State
    const [simUserMove, setSimUserMove] = useState<NormalizedMove>("rock");
    const [simOppMove, setSimOppMove] = useState<NormalizedMove>("scissors");
    const [simScore, setSimScore] = useState({ user: 2, opponent: 1 });
    const [simWinner, setSimWinner] = useState<"user" | "opponent" | "draw">("user");
    const [simClashKey, setSimClashKey] = useState(1);
    const [simIsAnimating, setSimIsAnimating] = useState(false);
    const [simStatusText, setSimStatusText] = useState("Rock crushes Scissors · You win");

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

    // Interactive Move Simulator Handler
    const handleSimulateMove = useCallback(
        (chosenMove: NormalizedMove) => {
            if (simIsAnimating) return;

            const possibleMoves: NormalizedMove[] = ["rock", "paper", "scissors"];
            // Pick an opponent move that creates interesting outcomes
            const randomOpp = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

            let winner: "user" | "opponent" | "draw" = "draw";
            let status = "Round tied";

            if (chosenMove === randomOpp) {
                winner = "draw";
                status = `Both threw ${chosenMove} · Round tied`;
            } else if (
                (chosenMove === "rock" && randomOpp === "scissors") ||
                (chosenMove === "paper" && randomOpp === "rock") ||
                (chosenMove === "scissors" && randomOpp === "paper")
            ) {
                winner = "user";
                const verb =
                    chosenMove === "rock"
                        ? "crushes"
                        : chosenMove === "paper"
                          ? "covers"
                          : "cuts";
                status = `${chosenMove} ${verb} ${randomOpp} · You win`;
            } else {
                winner = "opponent";
                const verb =
                    randomOpp === "rock"
                        ? "crushes"
                        : randomOpp === "paper"
                          ? "covers"
                          : "cuts";
                status = `${randomOpp} ${verb} ${chosenMove} · Opponent wins`;
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

            setTimeout(() => {
                setSimIsAnimating(false);
            }, 1200);
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

            // If backend is still establishing connection, verify readiness before proceeding
            if (backendHealth === "waking") {
                const isNowReady = await checkBackendHealth();
                if (!isNowReady) {
                    setIsSubmitting(false);
                    setApiError(
                        "Connecting to server. Please wait a moment and try again."
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
        userData?.nickname || contextNickname || (isLoggedIn ? "Player" : null);

    return (
        <main className="cheiron-landing">
            {/* Top Navigation Bar */}
            <header className="landing-top-bar">
                <div className="landing-brand-area">
                    <span className="landing-brand-name">CHEIRON</span>
                    <span className="landing-brand-sep">/</span>
                    <span className="landing-brand-tag">P2P Vision Duels</span>
                </div>

                <div className="landing-header-right">
                    {/* Backend Online Status */}
                    <div
                        className={`landing-status-badge ${
                            backendHealth === "ready" ? "is-ready" : "is-waking"
                        }`}
                        title={
                            backendHealth === "ready"
                                ? "Backend server is online and ready"
                                : "Connecting to backend server..."
                        }
                    >
                        <span className="status-dot" />
                        <span>
                            {backendHealth === "ready"
                                ? "Server Online"
                                : "Connecting..."}
                        </span>
                    </div>

                    {/* Profile Button */}
                    <button
                        type="button"
                        onClick={() => setIsProfileOpen(true)}
                        className="landing-profile-btn"
                        title={
                            isLoggedIn && activeUserDisplayName
                                ? `Profile: ${activeUserDisplayName}`
                                : "View Profile"
                        }
                        aria-label="Open player profile"
                    >
                        <User size={14} />
                        <span>
                            {isLoggedIn && activeUserDisplayName
                                ? activeUserDisplayName
                                : "Profile"}
                        </span>
                    </button>
                </div>
            </header>

            {/* Main Stage Grid: Setup Console (Left) + Live Interactive Duel Simulator (Right) */}
            <div className="landing-stage-grid">
                {/* Left Column: Match Setup Console */}
                <section className="landing-setup-col" aria-label="Game Setup">
                    <div className="landing-kicker">
                        <span className="landing-kicker-dot" />
                        <span>Webcam Gesture Duels</span>
                    </div>

                    <h1 className="landing-headline">
                        Play Rock Paper Scissors with your camera.
                    </h1>

                    <p className="landing-subcopy">
                        Face off with players over peer-to-peer live video. Real-time neural hand
                        tracking registers your move at the count of three. No controllers required.
                    </p>

                    {/* Reconnecting Alert Banner */}
                    <AnimatePresence>
                        {backendHealth === "waking" && (
                            <motion.div
                                className="landing-warmup-notice"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.2 }}
                            >
                                <RefreshCw size={14} className="spin-slow" />
                                <div>
                                    <strong>Connecting to server</strong>
                                    <p>
                                        Establishing connection with the matchmaking server...
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {backendHealth === "ready" && hasRecoveredFromWaking && (
                            <motion.div
                                className="landing-warmup-ready"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Check size={14} strokeWidth={2.4} />
                                <span>Backend server is online and ready!</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Pre-Match Setup Form */}
                    <form onSubmit={handleSubmit} className="landing-setup-form">
                        {/* Name Input */}
                        <div className="landing-field-group">
                            <label htmlFor="nickname" className="landing-field-label">
                                <span>Your name</span>
                                <span className="char-count">{nicknameInput.length} / 20</span>
                            </label>
                            <div className="landing-input-wrap">
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
                                    placeholder="Enter a nickname (e.g. Phoenix)"
                                    className="landing-text-input"
                                    autoComplete="nickname"
                                    autoFocus={!isLoggedIn}
                                    aria-invalid={Boolean(validationError)}
                                />
                            </div>
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

                        {/* Camera & Microphone Diagnostic Preview */}
                        <div className="landing-hardware-box">
                            <div className="hardware-box-header">
                                <div className="hardware-title-row">
                                    <Camera size={14} />
                                    <span>Camera & Microphone</span>
                                </div>
                                <span className={`hardware-status-pill ${permissionStatus}`}>
                                    {permissionStatus === "granted"
                                        ? "Connected"
                                        : permissionStatus === "requesting"
                                          ? "Checking..."
                                          : permissionStatus === "denied"
                                            ? "Blocked"
                                            : "Standby"}
                                </span>
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
                                    {/* Subtle optical crosshairs */}
                                    <span className="optical-crosshair ch-tl" aria-hidden="true" />
                                    <span className="optical-crosshair ch-tr" aria-hidden="true" />
                                    <span className="optical-crosshair ch-bl" aria-hidden="true" />
                                    <span className="optical-crosshair ch-br" aria-hidden="true" />
                                    <div className="hardware-ready-tag">
                                        <span className="ready-dot" />
                                        <span>Camera Ready</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="hardware-action-pane">
                                    <p className="hardware-prompt-desc">
                                        Cheiron needs camera access to track your gestures in real time.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={requestMediaPermissions}
                                        disabled={permissionStatus === "requesting"}
                                        className="hardware-trigger-btn"
                                    >
                                        <Video size={14} />
                                        <span>
                                            {permissionStatus === "requesting"
                                                ? "Connecting to camera..."
                                                : permissionStatus === "denied"
                                                  ? "Retry camera permission"
                                                  : "Test Camera & Microphone"}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {mediaError && (
                                <p className="hardware-error-notice" role="alert">
                                    {mediaError}
                                </p>
                            )}
                        </div>

                        {/* Submit Action CTA */}
                        <button
                            type="submit"
                            className="landing-submit-btn"
                            disabled={isSubmitting || permissionStatus === "requesting"}
                        >
                            <span>
                                {isSubmitting
                                    ? "Entering Matchmaking..."
                                    : isLoggedIn
                                      ? "Find a Match"
                                      : "Start Playing"}
                            </span>
                            <ArrowRight size={16} strokeWidth={2.4} />
                        </button>
                    </form>

                    {/* Grounded Specs Footer */}
                    <div className="landing-specs-row">
                        <span>WebRTC Peer-to-Peer</span>
                        <span className="specs-sep">·</span>
                        <span>MediaPipe Vision AI</span>
                        <span className="specs-sep">·</span>
                        <span>Best of 5 Rounds</span>
                    </div>
                </section>

                {/* Right Column: Live Interactive Match Simulator */}
                <section
                    className="landing-simulator-col"
                    aria-label="Interactive Match Preview"
                >
                    <div className="simulator-card">
                        {/* Simulator Top Header & Scoreboard */}
                        <div className="simulator-header">
                            <div className="simulator-scoreboard">
                                <div className="sim-player-side left">
                                    <span className="sim-player-name">
                                        {nicknameInput.trim() || "You"}
                                    </span>
                                    <span className="sim-score-num">{simScore.user}</span>
                                </div>
                                <div className="sim-score-divider">
                                    <span className="sim-round-label">Round 3 of 5</span>
                                    <span className="sim-vs">VS</span>
                                </div>
                                <div className="sim-player-side right">
                                    <span className="sim-score-num">{simScore.opponent}</span>
                                    <span className="sim-player-name">Opponent</span>
                                </div>
                            </div>
                        </div>

                        {/* Clash Arena Stage */}
                        <div className="simulator-arena-stage">
                            {/* Left Viewport: You */}
                            <div className="sim-video-pod sim-pod-left">
                                {permissionStatus === "granted" && previewStream ? (
                                    <video
                                        ref={(el) => {
                                            if (el && previewStream && el.srcObject !== previewStream) {
                                                el.srcObject = previewStream;
                                            }
                                        }}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="sim-pod-video"
                                    />
                                ) : (
                                    <div className="sim-pod-placeholder">
                                        <div className="sim-avatar-circle">
                                            <User size={18} />
                                        </div>
                                        <span>{nicknameInput.trim() || "You"}</span>
                                    </div>
                                )}
                                <div className="sim-pod-label">
                                    <span>{nicknameInput.trim() || "You"}</span>
                                    <span className="sim-tag">YOU</span>
                                </div>
                            </div>

                            {/* Center: Live 3D Hand Clash Stage */}
                            <div className="sim-clash-center">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={simClashKey}
                                        className="sim-clash-hands"
                                        initial={{ opacity: 0, scale: 0.94 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {/* User Hand (Left) */}
                                        <motion.div
                                            className="sim-hand-wrap left"
                                            animate={
                                                simWinner === "user"
                                                    ? { x: [0, 16, 4], scale: [1, 1.14, 1] }
                                                    : simWinner === "opponent"
                                                      ? { x: [0, -12], scale: [1, 0.82], opacity: [1, 0.5] }
                                                      : { x: [0, 8, 0] }
                                            }
                                            transition={{ duration: 0.6, ease: "easeOut" }}
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

                                        {/* Opponent Hand (Right) */}
                                        <motion.div
                                            className="sim-hand-wrap right"
                                            animate={
                                                simWinner === "opponent"
                                                    ? { x: [0, -16, -4], scale: [1, 1.14, 1] }
                                                    : simWinner === "user"
                                                      ? { x: [0, 12], scale: [1, 0.82], opacity: [1, 0.5] }
                                                      : { x: [0, -8, 0] }
                                            }
                                            transition={{ duration: 0.6, ease: "easeOut" }}
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

                                {/* Outcome Status Banner */}
                                <div
                                    className={`sim-outcome-pill outcome-${simWinner}`}
                                    aria-live="polite"
                                >
                                    <span>{simStatusText}</span>
                                </div>
                            </div>

                            {/* Right Viewport: Opponent */}
                            <div className="sim-video-pod sim-pod-right">
                                <div className="sim-pod-placeholder">
                                    <div className="sim-avatar-circle opponent">
                                        <User size={18} />
                                    </div>
                                    <span>Opponent</span>
                                </div>
                                <div className="sim-pod-label">
                                    <span>Opponent</span>
                                    <span className="sim-tag">STRANGER</span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Move Tester Controls */}
                        <div className="simulator-controls-bar">
                            <span className="controls-label">Test a move:</span>
                            <div className="move-buttons-group">
                                <button
                                    type="button"
                                    onClick={() => handleSimulateMove("rock")}
                                    disabled={simIsAnimating}
                                    className={`move-btn ${simUserMove === "rock" ? "is-selected" : ""}`}
                                    title="Throw Rock"
                                >
                                    <Circle size={15} />
                                    <span>Rock</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSimulateMove("paper")}
                                    disabled={simIsAnimating}
                                    className={`move-btn ${simUserMove === "paper" ? "is-selected" : ""}`}
                                    title="Throw Paper"
                                >
                                    <Hand size={15} />
                                    <span>Paper</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSimulateMove("scissors")}
                                    disabled={simIsAnimating}
                                    className={`move-btn ${simUserMove === "scissors" ? "is-selected" : ""}`}
                                    title="Throw Scissors"
                                >
                                    <Scissors size={15} />
                                    <span>Scissors</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Profile Management Modal */}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
            />
        </main>
    );
}
