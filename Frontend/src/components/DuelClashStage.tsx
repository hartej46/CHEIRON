import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Play, RefreshCw, ShieldAlert, Trophy } from "lucide-react";

export type NormalizedMove = "rock" | "paper" | "scissors" | "none";

export interface RoundResultData {
    winner: "user" | "opponent" | "draw";
    userMove: string;
    opponentMove: string;
    reason: string;
    round: number;
}

interface DuelClashStageProps {
    callState: "searching" | "connected" | "stopped";
    gamePhase:
        | "waiting"
        | "warmup"
        | "countdown"
        | "blackout"
        | "reveal"
        | "round_break"
        | "game_over";
    timer: number;
    round: number;
    scores: { user: number; opponent: number };
    lastRoundResult: RoundResultData | null;
    matchWinner: "user" | "opponent" | "draw" | null;
    connectionStatus: string;
    opponentNickname: string | null;
    onStartSearching: () => void;
    onNextOpponent: () => void;
}

function normalizeMove(raw?: string): NormalizedMove {
    const clean = (raw || "none").toLowerCase().trim();
    if (clean === "rock" || clean === "stone") return "rock";
    if (clean === "paper") return "paper";
    if (clean === "scissors" || clean === "scissor") return "scissors";
    return "none";
}

type ClashType =
    | "rock_breaks_scissors"
    | "paper_wraps_rock"
    | "scissors_cuts_paper"
    | "draw"
    | "forfeit";

function detectClashType(
    userMove: NormalizedMove,
    oppMove: NormalizedMove,
    winner: "user" | "opponent" | "draw"
): ClashType {
    if (winner === "draw") return "draw";
    if (userMove === "none" || oppMove === "none") return "forfeit";
    const winMove = winner === "user" ? userMove : oppMove;
    const loseMove = winner === "user" ? oppMove : userMove;
    if (winMove === "rock" && loseMove === "scissors") return "rock_breaks_scissors";
    if (winMove === "paper" && loseMove === "rock") return "paper_wraps_rock";
    if (winMove === "scissors" && loseMove === "paper") return "scissors_cuts_paper";
    return "forfeit";
}

interface SculptedHandProps {
    move: NormalizedMove;
    side: "left" | "right";
    role: "winner" | "loser" | "draw" | "neutral";
    uid: string;
    splitHalf?: "top" | "bottom" | "full";
}

const SculptedHandSVG: React.FC<SculptedHandProps> = ({
    move,
    side,
    role,
    uid,
    splitHalf = "full",
}) => {
    const rimColor =
        role === "winner"
            ? "#8be9c1"
            : role === "loser"
              ? "#ff9a9a"
              : "#c7ccd4";
    const bodyTop =
        role === "winner"
            ? "#363c3e"
            : role === "loser"
              ? "#242124"
              : "#32353d";
    const bodyMid =
        role === "winner"
            ? "#202427"
            : role === "loser"
              ? "#151518"
              : "#1d2026";
    const bodyDeep = "#0f1013";

    const gradId = `hand-grad-${uid}-${side}-${splitHalf}`;
    const rimId = `hand-rim-${uid}-${side}-${splitHalf}`;
    const clipId = `hand-clip-${uid}-${side}-${splitHalf}`;
    const mirrorTransform = side === "right" ? "translate(140, 0) scale(-1, 1)" : undefined;

    return (
        <svg
            viewBox="0 0 140 120"
            className={`clash-hand-svg side-${side} role-${role}`}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={bodyTop} />
                    <stop offset="52%" stopColor={bodyMid} />
                    <stop offset="100%" stopColor={bodyDeep} />
                </linearGradient>
                <linearGradient id={rimId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                    <stop offset="55%" stopColor={rimColor} stopOpacity="0.85" />
                    <stop offset="100%" stopColor={rimColor} stopOpacity="0.95" />
                </linearGradient>
                {splitHalf === "top" && (
                    <clipPath id={clipId}>
                        <polygon points="0,0 140,0 140,56 0,68" />
                    </clipPath>
                )}
                {splitHalf === "bottom" && (
                    <clipPath id={clipId}>
                        <polygon points="0,68 140,56 140,120 0,120" />
                    </clipPath>
                )}
            </defs>

            <g
                transform={mirrorTransform}
                clipPath={splitHalf !== "full" ? `url(#${clipId})` : undefined}
            >
                {move === "rock" && (
                    <g>
                        {/* Forearm cuff */}
                        <path
                            d="M 6 44 L 40 42 L 42 84 L 6 86 Z"
                            fill={`url(#${gradId})`}
                            stroke={`url(#${rimId})`}
                            strokeWidth="1.6"
                        />
                        {/* Sculpted 3D Fist / Stone Mass */}
                        <path
                            d="M 38 40 C 44 26 60 22 76 24 L 106 27 C 118 28 124 36 124 46 L 122 74 C 121 86 112 94 98 95 L 54 94 C 42 93 36 84 36 74 Z"
                            fill={`url(#${gradId})`}
                            stroke={`url(#${rimId})`}
                            strokeWidth="2"
                            strokeLinejoin="round"
                        />
                        {/* Knuckle facets for 3D depth */}
                        <path
                            d="M 78 26 L 76 58 M 96 27 L 94 60 M 112 31 L 110 62"
                            stroke="rgba(255,255,255,0.16)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                        {/* Clenched thumb bevel */}
                        <path
                            d="M 48 60 C 56 54 78 54 96 58 C 102 60 104 68 98 73 C 86 77 62 77 48 72 Z"
                            fill="#191b20"
                            stroke={rimColor}
                            strokeOpacity="0.55"
                            strokeWidth="1.5"
                        />
                        {/* Specular edge */}
                        <path
                            d="M 52 31 L 104 33"
                            stroke="rgba(255,255,255,0.28)"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                        />
                    </g>
                )}

                {move === "paper" && (
                    <g>
                        {/* Forearm cuff */}
                        <path
                            d="M 6 48 L 36 46 L 38 82 L 6 84 Z"
                            fill={`url(#${gradId})`}
                            stroke={`url(#${rimId})`}
                            strokeWidth="1.6"
                        />
                        {/* Open 3D Sculpted Palm & Extended Fingers */}
                        <path
                            d="M 34 45 L 52 24 C 57 19 65 20 67 27 L 58 43 L 112 32 C 120 31 124 37 121 43 L 82 50 L 125 49 C 132 49 134 57 127 60 L 84 62 L 122 66 C 129 67 129 75 121 76 L 80 74 L 108 82 C 114 84 112 92 104 91 L 52 86 C 40 85 34 78 34 68 Z"
                            fill={`url(#${gradId})`}
                            stroke={`url(#${rimId})`}
                            strokeWidth="1.9"
                            strokeLinejoin="round"
                        />
                        {/* Palm bevel lines */}
                        <path
                            d="M 52 52 C 62 56 68 64 66 76"
                            fill="none"
                            stroke="rgba(255,255,255,0.18)"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 78 44 L 116 37 M 82 56 L 122 55 M 80 68 L 118 71"
                            stroke="rgba(255,255,255,0.12)"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                        />
                    </g>
                )}

                {move === "scissors" && (
                    <g>
                        {/* Forearm cuff */}
                        <path
                            d="M 6 48 L 38 46 L 40 84 L 6 86 Z"
                            fill={`url(#${gradId})`}
                            stroke={`url(#${rimId})`}
                            strokeWidth="1.6"
                        />
                        {/* Upper V-Blade Finger */}
                        <path
                            d="M 56 48 L 122 20 C 129 17 135 24 129 30 L 76 58 Z"
                            fill={`url(#${gradId})`}
                            stroke={`url(#${rimId})`}
                            strokeWidth="1.9"
                            strokeLinejoin="round"
                        />
                        {/* Lower V-Blade Finger */}
                        <path
                            d="M 62 60 L 126 66 C 134 67 134 77 125 78 L 66 76 Z"
                            fill={`url(#${gradId})`}
                            stroke={`url(#${rimId})`}
                            strokeWidth="1.9"
                            strokeLinejoin="round"
                        />
                        {/* Curled Palm Body */}
                        <path
                            d="M 36 44 C 46 38 62 38 74 44 L 78 82 C 74 92 58 95 44 91 C 37 88 35 80 35 72 Z"
                            fill={`url(#${gradId})`}
                            stroke={`url(#${rimId})`}
                            strokeWidth="1.9"
                        />
                        {/* Folded knuckles & thumb */}
                        <path
                            d="M 50 62 C 58 58 72 60 76 68 C 72 76 58 78 48 73 Z"
                            fill="#181a1f"
                            stroke={rimColor}
                            strokeOpacity="0.5"
                            strokeWidth="1.4"
                        />
                        {/* Metallic blade bevel highlights */}
                        <path
                            d="M 76 46 L 122 26 M 78 68 L 124 72"
                            stroke="rgba(255,255,255,0.25)"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                        />
                    </g>
                )}

                {move === "none" && (
                    <g>
                        <rect
                            x="32"
                            y="28"
                            width="80"
                            height="64"
                            rx="18"
                            fill="rgba(255,255,255,0.02)"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="1.5"
                            strokeDasharray="5 5"
                        />
                        <line
                            x1="54"
                            y1="60"
                            x2="90"
                            y2="60"
                            stroke="rgba(255,255,255,0.25)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </g>
                )}
            </g>
        </svg>
    );
};

const SHARD_VECTORS = [
    { x: 26, y: -34, r: 52, delay: 0.28 },
    { x: 38, y: -12, r: -38, delay: 0.29 },
    { x: 22, y: 28, r: 74, delay: 0.3 },
    { x: -16, y: -26, r: -65, delay: 0.28 },
    { x: -24, y: 22, r: 44, delay: 0.31 },
    { x: 42, y: 14, r: -88, delay: 0.3 },
];

export const DuelClashStage: React.FC<DuelClashStageProps> = ({
    callState,
    gamePhase,
    timer,
    round,
    scores,
    lastRoundResult,
    matchWinner,
    connectionStatus,
    opponentNickname,
    onStartSearching,
    onNextOpponent,
}) => {
    const isConnected = callState === "connected";

    // Idle / Searching / Stopped state
    if (!isConnected) {
        return (
            <div className="duel-stage-inner duel-idle">
                <div className="duel-radar-wrap" aria-hidden="true">
                    {callState === "searching" ? (
                        <>
                            <span className="duel-ring ring-1" />
                            <span className="duel-ring ring-2" />
                            <span className="duel-core-dot pulsing" />
                        </>
                    ) : (
                        <span className="duel-core-dot idle" />
                    )}
                </div>
                <p className="duel-kicker">
                    {callState === "searching" ? "MATCHMAKING" : "PAUSED"}
                </p>
                <p className="duel-subcopy">{connectionStatus}</p>
                {callState === "stopped" && (
                    <button
                        type="button"
                        onClick={onStartSearching}
                        className="duel-primary-cta"
                    >
                        <Play size={14} fill="currentColor" />
                        <span>Find Partner</span>
                    </button>
                )}
            </div>
        );
    }

    // Warmup state
    if (gamePhase === "warmup" || gamePhase === "waiting") {
        return (
            <div className="duel-stage-inner duel-warmup">
                <span className="duel-phase-chip">GET READY</span>
                <motion.div
                    key={`warmup-${timer}`}
                    initial={{ scale: 0.85, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.22 }}
                    className="duel-big-number"
                >
                    {timer > 0 ? timer : "--"}
                </motion.div>
                <p className="duel-subcopy">Match starts soon. Position your camera.</p>
            </div>
        );
    }

    // Countdown state (5s ready phase before blackout)
    if (gamePhase === "countdown") {
        return (
            <div className="duel-stage-inner duel-countdown">
                <span className="duel-phase-chip accent">ROUND {Math.min(round || 1, 5)} / 5</span>
                <motion.div
                    key={`cd-${round}-${timer}`}
                    initial={{ scale: 1.28, opacity: 0.25, rotateX: 22 }}
                    animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                    transition={{ duration: 0.26, ease: "easeOut" }}
                    className="duel-big-number countdown-num"
                >
                    {timer}
                </motion.div>
                <p className="duel-subcopy">Show your hand clearly</p>
            </div>
        );
    }

    // Blackout / Scanning state (5s capture window)
    if (gamePhase === "blackout") {
        return (
            <div className="duel-stage-inner duel-blackout">
                <div className="duel-scan-orb" aria-hidden="true">
                    <Lock size={20} strokeWidth={2} />
                </div>
                <span className="duel-phase-chip scanning">LOCKING MOVE</span>
                <div className="duel-scan-timer">{timer}s</div>
                <p className="duel-subcopy">Hold steady while AI reads your hand</p>
            </div>
        );
    }

    // Reveal / Evaluating transition state
    if (gamePhase === "reveal") {
        return (
            <div className="duel-stage-inner duel-reveal">
                <div className="duel-eval-spinner" aria-hidden="true">
                    <RefreshCw size={22} className="spin-slow" />
                </div>
                <span className="duel-phase-chip">EVALUATING</span>
                <p className="duel-subcopy">
                    {connectionStatus.toLowerCase().includes("timed out") ||
                    connectionStatus.toLowerCase().includes("error")
                        ? connectionStatus
                        : `Resolving Round ${Math.min(lastRoundResult?.round || round || 1, 5)}...`}
                </p>
            </div>
        );
    }

    // Game Over state
    if (gamePhase === "game_over") {
        const verdictTitle =
            matchWinner === "user"
                ? "VICTORY"
                : matchWinner === "opponent"
                  ? "DEFEAT"
                  : "MATCH DRAW";
        const verdictClass =
            matchWinner === "user"
                ? "win"
                : matchWinner === "opponent"
                  ? "loss"
                  : "draw";

        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={`duel-stage-inner duel-gameover verdict-${verdictClass}`}
            >
                <div className={`duel-trophy-badge ${verdictClass}`}>
                    {matchWinner === "opponent" ? (
                        <ShieldAlert size={22} />
                    ) : (
                        <Trophy size={22} />
                    )}
                </div>
                <span className="duel-phase-chip">MATCH COMPLETE</span>
                <h2 className={`duel-verdict-title ${verdictClass}`}>{verdictTitle}</h2>
                <div className="duel-final-score">
                    <span>{scores.user}</span>
                    <span className="score-dash">-</span>
                    <span>{scores.opponent}</span>
                </div>
                <p className="duel-subcopy">
                    vs {opponentNickname || "Stranger"}
                </p>
                <button
                    type="button"
                    onClick={onNextOpponent}
                    className="duel-primary-cta"
                >
                    <span>Next Opponent</span>
                </button>
            </motion.div>
        );
    }

    // Round Break: 3D Animated Clash Arena
    const userMove = normalizeMove(lastRoundResult?.userMove);
    const oppMove = normalizeMove(lastRoundResult?.opponentMove);
    const winner = lastRoundResult?.winner || "draw";
    const clashType = detectClashType(userMove, oppMove, winner);
    const roundKey = `${lastRoundResult?.round ?? round}-${userMove}-${oppMove}-${winner}`;

    const userRole: "winner" | "loser" | "draw" =
        winner === "user" ? "winner" : winner === "opponent" ? "loser" : "draw";
    const oppRole: "winner" | "loser" | "draw" =
        winner === "opponent" ? "winner" : winner === "user" ? "loser" : "draw";

    const getHandAnimation = (side: "left" | "right") => {
        const dir = side === "left" ? 1 : -1;
        const isWinner =
            (side === "left" && winner === "user") ||
            (side === "right" && winner === "opponent");
        const isLoser =
            (side === "left" && winner === "opponent") ||
            (side === "right" && winner === "user");

        if (clashType === "draw") {
            return {
                initial: { x: -dir * 28, scale: 0.88, opacity: 0, rotateY: dir * 24 },
                animate: {
                    x: [-dir * 24, dir * 10, -dir * 4],
                    scale: [0.9, 1.06, 1],
                    rotateY: [dir * 20, -dir * 10, 0],
                    opacity: 1,
                },
                transition: { duration: 0.72, times: [0, 0.42, 1], ease: "easeOut" as const },
            };
        }

        if (isWinner) {
            if (clashType === "rock_breaks_scissors") {
                return {
                    initial: { x: -dir * 32, scale: 0.86, opacity: 0, rotateY: dir * 26 },
                    animate: {
                        x: [-dir * 24, -dir * 30, dir * 22, dir * 10],
                        scale: [0.92, 0.96, 1.22, 1.1],
                        rotateY: [dir * 18, dir * 26, -dir * 20, -dir * 8],
                        rotateZ: [0, -dir * 8, dir * 4, 0],
                        opacity: 1,
                    },
                    transition: { duration: 0.82, times: [0, 0.2, 0.44, 1], ease: "easeOut" as const },
                };
            }
            if (clashType === "paper_wraps_rock") {
                return {
                    initial: { x: -dir * 28, scale: 0.88, opacity: 0, rotateY: dir * 22 },
                    animate: {
                        x: [-dir * 20, dir * 20, dir * 10],
                        scale: [0.94, 1.22, 1.1],
                        rotateY: [dir * 18, -dir * 28, -dir * 10],
                        opacity: 1,
                    },
                    transition: { duration: 0.8, times: [0, 0.46, 1], ease: "easeOut" as const },
                };
            }
            if (clashType === "scissors_cuts_paper") {
                return {
                    initial: { x: -dir * 30, scale: 0.88, opacity: 0, rotateY: dir * 22 },
                    animate: {
                        x: [-dir * 22, dir * 22, dir * 10],
                        scale: [0.94, 1.18, 1.08],
                        rotateZ: [0, -dir * 14, dir * 6, 0],
                        rotateY: [dir * 18, -dir * 18, -dir * 8],
                        opacity: 1,
                    },
                    transition: { duration: 0.82, times: [0, 0.44, 0.72, 1], ease: "easeOut" as const },
                };
            }
            return {
                initial: { x: -dir * 20, scale: 0.9, opacity: 0 },
                animate: { x: dir * 6, scale: 1.08, opacity: 1 },
                transition: { duration: 0.5, ease: "easeOut" as const },
            };
        }

        if (isLoser) {
            if (clashType === "rock_breaks_scissors") {
                return {
                    initial: { x: -dir * 24, scale: 0.92, opacity: 0 },
                    animate: {
                        x: [-dir * 14, -dir * 10, -dir * 28],
                        scale: [0.96, 1.02, 0.78],
                        rotateZ: [0, 0, -dir * 28],
                        rotateY: [0, 0, -dir * 36],
                        opacity: [1, 1, 0.34],
                    },
                    transition: { duration: 0.85, times: [0, 0.34, 1], ease: "easeOut" as const },
                };
            }
            if (clashType === "paper_wraps_rock") {
                return {
                    initial: { x: -dir * 20, scale: 0.95, opacity: 0 },
                    animate: {
                        x: [-dir * 12, -dir * 10, -dir * 18],
                        scale: [1, 0.98, 0.68],
                        rotateY: [0, 0, -dir * 30],
                        opacity: [1, 1, 0.32],
                    },
                    transition: { duration: 0.85, times: [0, 0.36, 1], ease: "easeOut" as const },
                };
            }
            return {
                initial: { x: -dir * 18, scale: 0.92, opacity: 0 },
                animate: { x: -dir * 14, scale: 0.8, opacity: 0.35 },
                transition: { duration: 0.65, ease: "easeOut" as const },
            };
        }

        return {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: { duration: 0.3 },
        };
    };

    const leftIsCutPaper = clashType === "scissors_cuts_paper" && winner === "opponent";
    const rightIsCutPaper = clashType === "scissors_cuts_paper" && winner === "user";
    const showShardsLeft = clashType === "rock_breaks_scissors" && winner === "opponent";
    const showShardsRight = clashType === "rock_breaks_scissors" && winner === "user";

    const verdictText =
        winner === "user"
            ? `YOU WON ROUND ${lastRoundResult?.round || round}`
            : winner === "opponent"
              ? `YOU LOST ROUND ${lastRoundResult?.round || round}`
              : `ROUND ${lastRoundResult?.round || round} TIED`;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={roundKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`duel-stage-inner duel-clash outcome-${winner}`}
            >
                <span className={`duel-verdict-pill outcome-${winner}`}>
                    {verdictText}
                </span>

                {/* 3D Perspective Clash Arena */}
                <div className="clash-3d-viewport">
                    {/* Subtle radial depth floor */}
                    <div className={`clash-depth-ring outcome-${winner}`} aria-hidden="true" />

                    {/* Impact shockwave on collision */}
                    <motion.div
                        className={`clash-shockwave outcome-${winner}`}
                        initial={{ scale: 0.15, opacity: 0 }}
                        animate={{ scale: [0.2, 1.35, 1.8], opacity: [0, 0.85, 0] }}
                        transition={{ duration: 0.65, delay: 0.25, ease: "easeOut" }}
                        aria-hidden="true"
                    />

                    {/* Wrap aura for Paper beats Rock */}
                    {clashType === "paper_wraps_rock" && (
                        <motion.div
                            className={`clash-wrap-ring side-${winner === "user" ? "right" : "left"}`}
                            initial={{ scale: 1.5, opacity: 0 }}
                            animate={{ scale: [1.5, 0.92, 0.82], opacity: [0, 0.75, 0.25] }}
                            transition={{ duration: 0.7, delay: 0.26, ease: "easeOut" }}
                            aria-hidden="true"
                        />
                    )}

                    {/* Slash streak for Scissors beats Paper */}
                    {clashType === "scissors_cuts_paper" && (
                        <motion.div
                            className={`clash-slash-beam side-${winner === "user" ? "right" : "left"}`}
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: [0, 1.2, 0], opacity: [0, 1, 0] }}
                            transition={{ duration: 0.45, delay: 0.26, ease: "easeOut" }}
                            aria-hidden="true"
                        />
                    )}

                    <div className="clash-hands-row">
                        {/* Left Hand (YOU) */}
                        <div className="clash-hand-slot slot-left">
                            {leftIsCutPaper ? (
                                <div className="split-paper-wrapper">
                                    <motion.div
                                        className="split-half"
                                        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                                        animate={{ x: -12, y: -18, rotate: -16, opacity: 0.35 }}
                                        transition={{ duration: 0.65, delay: 0.28, ease: "easeOut" }}
                                    >
                                        <SculptedHandSVG
                                            move="paper"
                                            side="left"
                                            role="loser"
                                            uid={roundKey}
                                            splitHalf="top"
                                        />
                                    </motion.div>
                                    <motion.div
                                        className="split-half"
                                        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                                        animate={{ x: -14, y: 18, rotate: 18, opacity: 0.3 }}
                                        transition={{ duration: 0.65, delay: 0.28, ease: "easeOut" }}
                                    >
                                        <SculptedHandSVG
                                            move="paper"
                                            side="left"
                                            role="loser"
                                            uid={roundKey}
                                            splitHalf="bottom"
                                        />
                                    </motion.div>
                                </div>
                            ) : (
                                <motion.div
                                    className="clash-hand-actor"
                                    {...getHandAnimation("left")}
                                >
                                    <SculptedHandSVG
                                        move={userMove}
                                        side="left"
                                        role={userRole}
                                        uid={roundKey}
                                    />
                                </motion.div>
                            )}

                            {showShardsLeft && (
                                <div className="clash-shards" aria-hidden="true">
                                    {SHARD_VECTORS.map((s, idx) => (
                                        <motion.span
                                            key={idx}
                                            className="clash-shard"
                                            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.6 }}
                                            animate={{
                                                x: -s.x,
                                                y: s.y,
                                                rotate: s.r,
                                                opacity: [0, 1, 0],
                                                scale: [0.6, 1.1, 0.3],
                                            }}
                                            transition={{ duration: 0.62, delay: s.delay, ease: "easeOut" }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right Hand (STRANGER) */}
                        <div className="clash-hand-slot slot-right">
                            {rightIsCutPaper ? (
                                <div className="split-paper-wrapper">
                                    <motion.div
                                        className="split-half"
                                        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                                        animate={{ x: 12, y: -18, rotate: 16, opacity: 0.35 }}
                                        transition={{ duration: 0.65, delay: 0.28, ease: "easeOut" }}
                                    >
                                        <SculptedHandSVG
                                            move="paper"
                                            side="right"
                                            role="loser"
                                            uid={roundKey}
                                            splitHalf="top"
                                        />
                                    </motion.div>
                                    <motion.div
                                        className="split-half"
                                        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                                        animate={{ x: 14, y: 18, rotate: -18, opacity: 0.3 }}
                                        transition={{ duration: 0.65, delay: 0.28, ease: "easeOut" }}
                                    >
                                        <SculptedHandSVG
                                            move="paper"
                                            side="right"
                                            role="loser"
                                            uid={roundKey}
                                            splitHalf="bottom"
                                        />
                                    </motion.div>
                                </div>
                            ) : (
                                <motion.div
                                    className="clash-hand-actor"
                                    {...getHandAnimation("right")}
                                >
                                    <SculptedHandSVG
                                        move={oppMove}
                                        side="right"
                                        role={oppRole}
                                        uid={roundKey}
                                    />
                                </motion.div>
                            )}

                            {showShardsRight && (
                                <div className="clash-shards" aria-hidden="true">
                                    {SHARD_VECTORS.map((s, idx) => (
                                        <motion.span
                                            key={idx}
                                            className="clash-shard"
                                            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.6 }}
                                            animate={{
                                                x: s.x,
                                                y: s.y,
                                                rotate: s.r,
                                                opacity: [0, 1, 0],
                                                scale: [0.6, 1.1, 0.3],
                                            }}
                                            transition={{ duration: 0.62, delay: s.delay, ease: "easeOut" }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Move Matchup & Reason */}
                <div className="clash-caption-block">
                    <div className="clash-move-pair">
                        <span className={`move-label role-${userRole}`}>
                            {userMove === "none" ? "NONE" : userMove.toUpperCase()}
                        </span>
                        <span className="move-vs">vs</span>
                        <span className={`move-label role-${oppRole}`}>
                            {oppMove === "none" ? "NONE" : oppMove.toUpperCase()}
                        </span>
                    </div>
                    {lastRoundResult?.reason && (
                        <p className="clash-reason">{lastRoundResult.reason}</p>
                    )}
                    <div className="clash-next-timer">
                        Next round in <strong>{timer}s</strong>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default DuelClashStage;
