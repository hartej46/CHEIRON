import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Check, Circle, Hand, Mic, Scissors, Video } from "lucide-react";
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

        // 4. Submit session initiation/update request to backend
        try {
            setIsSubmitting(true);
            setApiError(null);
            setValidationError(null);
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
        hidden: { opacity: 0, y: 18 },
        visible: (index = 0) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: index * 0.08,
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1] as const,
            },
        }),
    };

    return (
        <main className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-zinc-950 text-foreground overflow-x-hidden">
            <section className="rps-hero" aria-labelledby="rps-title">
                <div className="rps-hero-grid" aria-hidden="true" />
                <motion.header
                    className="rps-hero-header"
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                >
                    <span className="rps-wordmark">CHEIRON</span>
                    <span className="rps-mode">live room / 01</span>
                </motion.header>

                <div className="rps-hero-content">
                    <motion.p
                        className="rps-kicker"
                        variants={reveal}
                        custom={0}
                        initial="hidden"
                        animate="visible"
                    >
                        Real-time hand play
                    </motion.p>
                    <motion.h1
                        id="rps-title"
                        className="rps-title text-6xl md:text-8xl lg:text-[7vw] leading-none tracking-tighter"
                        variants={reveal}
                        custom={1}
                        initial="hidden"
                        animate="visible"
                    >
                        Rock.
                        <br />
                        Paper.
                        <br />
                        Scissors.
                    </motion.h1>
                    <motion.p
                        className="rps-subtitle"
                        variants={reveal}
                        custom={2}
                        initial="hidden"
                        animate="visible"
                    >
                        Powered by <span>AI hand tracking</span>
                    </motion.p>

                    <div className="rps-symbol-stage" aria-label="Rock, paper, and scissors">
                        {[
                            { label: "Rock", Icon: Circle },
                            { label: "Paper", Icon: Hand },
                            { label: "Scissors", Icon: Scissors },
                        ].map(({ label, Icon }, index) => (
                            <motion.div
                                className={`rps-symbol rps-symbol-${index + 1}`}
                                key={label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: [0, -20, 0] }}
                                transition={{
                                    opacity: { delay: 0.35 + index * 0.12, duration: 0.45 },
                                    y: {
                                        delay: 0.8 + index * 0.22,
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    },
                                }}
                            >
                                <Icon strokeWidth={1.4} aria-hidden="true" />
                                <span>{label}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="rps-hero-footer">
                    <span>Choose your move</span>
                    <span className="rps-footer-line" aria-hidden="true" />
                    <span>Enter the arena</span>
                </div>
            </section>

            <section
                className="rps-action-area flex h-full flex-col justify-center px-8 lg:px-24"
                aria-labelledby="landing-title"
            >
                <motion.div
                    className="rps-setup-content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    <motion.div
                        className="rps-card-topline"
                        variants={reveal}
                        custom={0}
                        initial="hidden"
                        animate="visible"
                    >
                        <span className="rps-card-label">Setup / 01</span>
                        <button
                            type="button"
                            onClick={() => setIsProfileOpen(true)}
                            className="rps-profile-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 active:scale-[0.98]"
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
                            <span>
                                {isLoggedIn && activeUserDisplayName
                                    ? activeUserDisplayName
                                    : "Profile"}
                            </span>
                        </button>
                    </motion.div>

                    <motion.h2
                        id="landing-title"
                        className="rps-welcome"
                        variants={reveal}
                        custom={1}
                        initial="hidden"
                        animate="visible"
                    >
                        {isLoggedIn && activeUserDisplayName
                            ? `Welcome, ${activeUserDisplayName}`
                            : "Ready to play?"}
                    </motion.h2>
                    <motion.p
                        className="rps-intro"
                        variants={reveal}
                        custom={2}
                        initial="hidden"
                        animate="visible"
                    >
                        {isLoggedIn && activeUserDisplayName
                            ? "Your room is waiting. Confirm your setup before you play."
                            : "Set your name and give the room access to your camera and microphone."}
                    </motion.p>

                        {isLoggedIn && activeUserDisplayName && (
                            <motion.div
                                className="rps-session-note"
                                variants={reveal}
                                custom={3}
                                initial="hidden"
                                animate="visible"
                            >
                                <Check size={14} aria-hidden="true" />
                                Continuing as <strong>{activeUserDisplayName}</strong>
                            </motion.div>
                        )}

                        <motion.div
                            className={`rps-diagnostics ${permissionStatus === "prompt" ? "is-pending" : ""}`}
                            variants={reveal}
                            custom={4}
                            initial="hidden"
                            animate="visible"
                        >
                            <div className="rps-diagnostics-heading">
                                <span className="rps-diagnostics-icon">
                                    <Video size={16} aria-hidden="true" />
                                    <Mic size={16} aria-hidden="true" />
                                </span>
                                <div>
                                    <strong>System diagnostics</strong>
                                    <span>
                                        {permissionStatus === "granted"
                                            ? "Hardware is ready"
                                            : permissionStatus === "requesting"
                                              ? "Waiting for browser access"
                                              : "Camera and microphone check"}
                                    </span>
                                </div>
                                <span className={`rps-diagnostics-status ${permissionStatus}`} />
                            </div>

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
                                        <Check size={13} />
                                        Camera & mic active
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="permission-text">
                                        {permissionStatus === "denied"
                                            ? "Access is blocked. Allow camera and microphone permissions to continue."
                                            : "Allow access to test your setup before entering the room."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={requestMediaPermissions}
                                        disabled={permissionStatus === "requesting"}
                                        className="permission-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {permissionStatus === "requesting"
                                            ? "Requesting access..."
                                            : permissionStatus === "denied"
                                              ? "Try again"
                                              : "Enable camera & mic"}
                                    </button>
                                </>
                            )}
                        </motion.div>

                        <AnimatePresence initial={false}>
                            {mediaError && (
                                <motion.p
                                    className="form-error media-block-error"
                                    role="alert"
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {mediaError}
                                </motion.p>
                            )}
                        </AnimatePresence>

                        <motion.form
                            onSubmit={handleSubmit}
                            className="rps-nickname-form"
                            variants={reveal}
                            custom={5}
                            initial="hidden"
                            animate="visible"
                        >
                            <label htmlFor="nickname">
                                {isLoggedIn ? "Nickname (editable)" : "Choose a nickname"}
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
                                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
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
                                className="primary-button rps-continue-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isSubmitting || permissionStatus === "requesting"}
                            >
                                {isSubmitting
                                    ? "Starting..."
                                    : isLoggedIn
                                      ? "Continue to video chat"
                                      : "Start chatting"}
                                <span aria-hidden="true">↗</span>
                            </button>
                        </motion.form>
                </motion.div>
            </section>

            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
            />
        </main>
    );
}
