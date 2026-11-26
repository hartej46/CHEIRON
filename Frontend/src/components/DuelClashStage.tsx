import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Play, RefreshCw, ShieldAlert, Trophy } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { SketchButton, SketchDivider, SketchSurface } from "./SketchPrimitives";

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

export function normalizeMove(raw?: string): NormalizedMove {
    const clean = (raw || "none").toLowerCase().trim();
    if (clean === "rock" || clean === "stone") return "rock";
    if (clean === "paper") return "paper";
    if (clean === "scissors" || clean === "scissor") return "scissors";
    return "none";
}

export type ClashType =
    | "rock_breaks_scissors"
    | "paper_wraps_rock"
    | "scissors_cuts_paper"
    | "draw"
    | "forfeit";

export function detectClashType(
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

export interface SculptedHandProps {
    move: NormalizedMove;
    side: "left" | "right";
    role: "winner" | "loser" | "draw" | "neutral";
    uid: string;
    splitHalf?: "top" | "bottom" | "full";
}

/**
 * Hand-drawn colorful comic-sketch 3D hand SVG with zero-blur offset ink shadow,
 * pencil hatching lines, and pastel Neobrutalist fills.
 */
export const SculptedHandSVG: React.FC<SculptedHandProps> = ({
    move,
    side,
    role,
    uid,
    splitHalf = "full",
}) => {
    const { isDark } = useTheme();
    const isWin = role === "winner";
    const isLoss = role === "loser";

    const outerInk = isDark ? "#FFFFFF" : "#111111";

    const cuffFill = isWin ? "#FFE566" : isLoss ? "#E8635A" : "#C4B5FD";

    const rockMain = isWin ? "#4ECDC4" : isLoss ? "#F9A8B8" : "#C4B5FD";
    const rockBevel = isWin ? "#2FB0A8" : isLoss ? "#E8635A" : "#9E8BF5";

    const paperMain = isWin ? "#FFE566" : isLoss ? "#F9A8B8" : "#FFFFFF";
    const paperBevel = isWin ? "#F5CF36" : isLoss ? "#E8635A" : "#FAFADF";

    const scissorMain = isWin ? "#4ECDC4" : isLoss ? "#F9A8B8" : "#E8635A";
    const scissorBlade = isWin ? "#FFE566" : isLoss ? "#FCE7EB" : "#FFE566";

    const clipId = `sketch-hand-clip-${uid}-${side}-${splitHalf}`;
    const mirrorTransform = side === "right" ? "translate(140, 0) scale(-1, 1)" : undefined;

    const renderGeometry = (isShadowPass: boolean) => {
        const ink = outerInk;
        const fillCuff = isShadowPass ? ink : cuffFill;
        const fillRock = isShadowPass ? ink : rockMain;
        const fillRockBevel = isShadowPass ? ink : rockBevel;
        const fillPaper = isShadowPass ? ink : paperMain;
        const fillPaperBevel = isShadowPass ? ink : paperBevel;
        const fillScissor = isShadowPass ? ink : scissorMain;
        const fillBlade = isShadowPass ? ink : scissorBlade;
        const strokeInk = ink;
        const strokeW = isShadowPass ? 2.4 : 2.8;

        return (
            <>
                {move === "rock" && (
                    <g>
                        {/* Forearm sleeve cuff */}
                        <path
                            d="M 7 45 C 19 42, 29 44, 41 42 L 43 84 C 31 85, 19 86, 7 85 C 5 71, 6 58, 7 45 Z"
                            fill={fillCuff}
                            stroke={strokeInk}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Sculpted chunky 3D stone fist */}
                        <path
                            d="M 38 40 C 44 25, 62 21, 78 23 C 89 24, 98 25, 107 27 C 119 28, 125 36, 124 47 L 122 74 C 120 87, 111 94, 97 95 C 82 95, 67 94, 53 94 C 41 93, 36 83, 36 73 C 36 62, 37 51, 38 40 Z"
                            fill={fillRock}
                            stroke={strokeInk}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {!isShadowPass && (
                            <>
                                {/* Finger/knuckle facet dividers */}
                                <path
                                    d="M 78 25 C 77 37, 77 48, 76 58 M 96 27 C 95 39, 95 49, 94 60 M 112 31 C 111 42, 111 51, 110 62"
                                    fill="none"
                                    stroke="#111111"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                                {/* Clenched thumb bevel */}
                                <path
                                    d="M 48 61 C 57 54, 79 54, 96 58 C 103 60, 104 69, 97 74 C 84 78, 61 77, 48 72 C 45 69, 46 64, 48 61 Z"
                                    fill={fillRockBevel}
                                    stroke="#111111"
                                    strokeWidth="2.2"
                                    strokeLinejoin="round"
                                />
                                {/* Pencil cross-hatch & top specular highlight */}
                                <path
                                    d="M 52 32 C 68 30, 88 31, 104 33"
                                    fill="none"
                                    stroke="#FFFFFF"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M 54 84 L 61 89 M 64 84 L 71 89 M 74 84 L 81 89 M 16 54 L 22 60 M 23 54 L 29 60"
                                    fill="none"
                                    stroke="#111111"
                                    strokeWidth="1.5"
                                    strokeOpacity="0.65"
                                    strokeLinecap="round"
                                />
                            </>
                        )}
                    </g>
                )}

                {move === "paper" && (
                    <g>
                        {/* Forearm cuff */}
                        <path
                            d="M 7 49 C 18 47, 27 47, 37 46 L 39 82 C 29 83, 18 84, 7 83 C 5 72, 6 60, 7 49 Z"
                            fill={fillCuff}
                            stroke={strokeInk}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Open sculpted palm & extended hand-drawn fingers */}
                        <path
                            d="M 34 45 L 52 24 C 57 18, 66 20, 67 27 L 58 43 L 112 31 C 120 30, 125 37, 121 43 L 82 50 L 125 49 C 132 49, 134 57, 127 60 L 84 62 L 122 66 C 129 67, 129 75, 121 76 L 80 74 L 108 82 C 114 84, 112 92, 104 91 L 52 86 C 40 85, 34 78, 34 68 Z"
                            fill={fillPaper}
                            stroke={strokeInk}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {!isShadowPass && (
                            <>
                                {/* Palm shaded facet */}
                                <path
                                    d="M 46 68 C 58 72, 70 74, 80 74 L 103 84 L 54 83 C 44 82, 41 75, 46 68 Z"
                                    fill={fillPaperBevel}
                                    stroke="none"
                                />
                                {/* Inked palm crease & finger sketch lines */}
                                <path
                                    d="M 52 52 C 62 56, 68 65, 66 76"
                                    fill="none"
                                    stroke="#111111"
                                    strokeWidth="2.1"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M 79 44 C 92 41, 104 39, 115 37 M 83 56 C 97 56, 109 55, 121 55 M 81 68 C 94 69, 106 70, 117 71"
                                    fill="none"
                                    stroke="#111111"
                                    strokeWidth="1.7"
                                    strokeOpacity="0.65"
                                    strokeLinecap="round"
                                />
                                {/* Jagged tear seam when sliced */}
                                {splitHalf !== "full" && (
                                    <path
                                        d="M 32 65 L 48 61 L 64 64 L 82 59 L 101 62 L 122 57"
                                        fill="none"
                                        stroke="#E8635A"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                )}
                            </>
                        )}
                    </g>
                )}

                {move === "scissors" && (
                    <g>
                        {/* Forearm cuff */}
                        <path
                            d="M 7 49 C 18 46, 28 47, 39 46 L 41 84 C 30 85, 18 85, 7 85 C 5 73, 6 61, 7 49 Z"
                            fill={fillCuff}
                            stroke={strokeInk}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Upper V-Blade Finger */}
                        <path
                            d="M 56 48 L 122 19 C 130 16, 136 24, 129 30 L 76 58 Z"
                            fill={fillBlade}
                            stroke={strokeInk}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Lower V-Blade Finger */}
                        <path
                            d="M 62 60 L 126 66 C 135 67, 134 78, 125 78 L 66 76 Z"
                            fill={fillBlade}
                            stroke={strokeInk}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Curled Palm Body */}
                        <path
                            d="M 36 44 C 46 37, 62 38, 74 44 C 77 56, 78 69, 77 82 C 73 92, 58 95, 44 91 C 37 88, 35 80, 35 72 Z"
                            fill={fillScissor}
                            stroke={strokeInk}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {!isShadowPass && (
                            <>
                                {/* Folded thumb & curled knuckles */}
                                <path
                                    d="M 49 62 C 58 58, 72 60, 76 68 C 72 76, 58 78, 48 73 C 45 70, 46 65, 49 62 Z"
                                    fill="#FFFFFF"
                                    stroke="#111111"
                                    strokeWidth="2.1"
                                />
                                {/* Blade bevel sheen */}
                                <path
                                    d="M 78 44 L 122 25 M 79 68 L 123 72"
                                    fill="none"
                                    stroke="#111111"
                                    strokeWidth="1.7"
                                    strokeOpacity="0.65"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M 46 47 L 52 53 M 54 47 L 60 53"
                                    fill="none"
                                    stroke="#111111"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                            </>
                        )}
                    </g>
                )}

                {move === "none" && (
                    <g>
                        <path
                            d="M 35 30 C 59 27, 86 28, 109 30 C 114 31, 114 55, 112 88 C 87 92, 58 92, 34 89 C 31 66, 32 45, 35 30 Z"
                            fill={isShadowPass ? ink : isDark ? "#25252C" : "#FAFADF"}
                            stroke={strokeInk}
                            strokeWidth={2.5}
                            strokeDasharray={isShadowPass ? undefined : "7 5"}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {!isShadowPass && (
                            <path
                                d="M 55 59 Q 72 56 89 60"
                                fill="none"
                                stroke="#E8635A"
                                strokeWidth="3.2"
                                strokeLinecap="round"
                            />
                        )}
                    </g>
                )}
            </>
        );
    };

    return (
        <svg
            viewBox="0 0 144 126"
            className={`clash-hand-svg side-${side} role-${role}`}
            aria-hidden="true"
        >
            <defs>
                {splitHalf === "top" && (
                    <clipPath id={clipId}>
                        <polygon points="0,0 144,0 144,57 96,62 60,64 0,68" />
                    </clipPath>
                )}
                {splitHalf === "bottom" && (
                    <clipPath id={clipId}>
                        <polygon points="0,68 60,64 96,62 144,57 144,126 0,126" />
                    </clipPath>
                )}
            </defs>

            <g
                transform={mirrorTransform}
                clipPath={splitHalf !== "full" ? `url(#${clipId})` : undefined}
            >
                {/* Hard zero-blur offset shadow layer */}
                <g transform="translate(3.5, 4)">{renderGeometry(true)}</g>
                {/* Foreground colorful inked hand */}
                <g>{renderGeometry(false)}</g>
            </g>
        </svg>
    );
};

const SHARD_VECTORS = [
    { x: 28, y: -36, r: 52, delay: 0.28, color: "#FFE566" },
    { x: 40, y: -14, r: -38, delay: 0.29, color: "#E8635A" },
    { x: 24, y: 30, r: 74, delay: 0.3, color: "#4ECDC4" },
    { x: -18, y: -28, r: -65, delay: 0.28, color: "#F9A8B8" },
    { x: -24, y: 24, r: 44, delay: 0.31, color: "#C4B5FD" },
    { x: 42, y: 16, r: -88, delay: 0.3, color: "#FFFFFF" },
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
    const { isDark } = useTheme();
    const isConnected = callState === "connected";
    const neutralCardFill = isDark ? "#1C1C21" : "#FFFFFF";
    const ink = isDark ? "#FFFFFF" : "#111111";

    // Idle / Searching / Stopped state
    if (!isConnected) {
        return (
            <SketchSurface
                fill={neutralCardFill}
                shadow={5}
                radius={20}
                seed="duel-idle"
                className="duel-sketch-card"
                innerClassName="duel-stage-inner duel-idle"
            >
                <div className="duel-radar-wrap" aria-hidden="true">
                    {callState === "searching" ? (
                        <svg width="72" height="72" viewBox="0 0 72 72" className="sketch-radar-svg">
                            <circle
                                cx="36"
                                cy="36"
                                r="28"
                                fill={isDark ? "#25252C" : "#FAFADF"}
                                stroke={ink}
                                strokeWidth="2.4"
                                strokeDasharray="8 6"
                                className="sketch-spin-radar"
                            />
                            <circle
                                cx="36"
                                cy="36"
                                r="18"
                                fill="#FFE566"
                                stroke="#111111"
                                strokeWidth="2.2"
                            />
                            <path
                                d="M36 25 L38 34 L47 36 L38 38 L36 47 L34 38 L25 36 L34 34 Z"
                                fill="#4ECDC4"
                                stroke="#111111"
                                strokeWidth="1.6"
                                strokeLinejoin="round"
                            />
                        </svg>
                    ) : (
                        <svg width="64" height="64" viewBox="0 0 64 64" className="sketch-radar-svg">
                            <path
                                d="M32 6 C47 5, 58 17, 57 32 C56 48, 45 58, 31 57 C16 56, 6 46, 7 31 C8 16, 19 7, 32 6 Z"
                                transform="translate(2.5, 2.5)"
                                fill={ink}
                            />
                            <path
                                d="M32 6 C47 5, 58 17, 57 32 C56 48, 45 58, 31 57 C16 56, 6 46, 7 31 C8 16, 19 7, 32 6 Z"
                                fill="#F9A8B8"
                                stroke={ink}
                                strokeWidth="2.4"
                            />
                            <rect x="23" y="22" width="6" height="20" rx="2" fill="#111111" />
                            <rect x="35" y="22" width="6" height="20" rx="2" fill="#111111" />
                        </svg>
                    )}
                </div>

                <span
                    className={`duel-phase-chip ${
                        callState === "searching" ? "chip-yellow" : "chip-pink"
                    }`}
                >
                    {callState === "searching" ? "finding opponent" : "paused"}
                </span>

                <p className="duel-subcopy">{connectionStatus}</p>

                {callState === "stopped" && (
                    <SketchButton
                        fill="#4ECDC4"
                        shadow={4}
                        radius={12}
                        seed="duel-start-btn"
                        onClick={onStartSearching}
                        faceClassName="duel-primary-cta-face"
                    >
                        <Play size={14} fill="#111111" />
                        <span>find partner</span>
                    </SketchButton>
                )}
            </SketchSurface>
        );
    }

    // Warmup state
    if (gamePhase === "warmup" || gamePhase === "waiting") {
        return (
            <SketchSurface
                fill={neutralCardFill}
                shadow={5}
                radius={20}
                seed="duel-warmup"
                className="duel-sketch-card"
                innerClassName="duel-stage-inner duel-warmup"
            >
                <span className="duel-phase-chip chip-yellow">get ready</span>
                <motion.div
                    key={`warmup-${timer}`}
                    initial={{ scale: 0.85, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.22 }}
                    className="duel-big-number"
                >
                    {timer > 0 ? timer : "--"}
                </motion.div>
                <SketchDivider orientation="horizontal" length={76} color="#E8635A" />
                <p className="duel-subcopy">match starts soon. position your camera.</p>
            </SketchSurface>
        );
    }

    // Countdown state (5s ready phase before blackout)
    if (gamePhase === "countdown") {
        return (
            <SketchSurface
                fill={neutralCardFill}
                shadow={5}
                radius={20}
                seed="duel-countdown"
                className="duel-sketch-card"
                innerClassName="duel-stage-inner duel-countdown"
            >
                <span className="duel-phase-chip chip-lavender">
                    round {Math.min(round || 1, 5)} of 5
                </span>
                <motion.div
                    key={`cd-${round}-${timer}`}
                    initial={{ scale: 1.24, opacity: 0.35 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="duel-big-number countdown-num"
                >
                    {timer}
                </motion.div>
                <p className="duel-subcopy">show your hand clearly</p>
            </SketchSurface>
        );
    }

    // Blackout / Scanning state (5s capture window)
    if (gamePhase === "blackout") {
        return (
            <SketchSurface
                fill="#FFE566"
                shadow={5}
                radius={20}
                seed="duel-blackout"
                className="duel-sketch-card"
                innerClassName="duel-stage-inner duel-blackout"
            >
                <div className="duel-scan-orb" aria-hidden="true">
                    <Lock size={22} strokeWidth={2.5} color="#111111" />
                </div>
                <span className="duel-phase-chip chip-coral">locking move</span>
                <div className="duel-scan-timer">{timer}s</div>
                <p className="duel-subcopy">hold steady while ai reads your hand</p>
            </SketchSurface>
        );
    }

    // Reveal / Evaluating transition state
    if (gamePhase === "reveal") {
        return (
            <SketchSurface
                fill="#C4B5FD"
                shadow={5}
                radius={20}
                seed="duel-reveal"
                className="duel-sketch-card"
                innerClassName="duel-stage-inner duel-reveal"
            >
                <div className="duel-eval-spinner" aria-hidden="true">
                    <RefreshCw size={22} strokeWidth={2.5} color="#111111" className="spin-slow" />
                </div>
                <span className="duel-phase-chip chip-white">evaluating</span>
                <p className="duel-subcopy">
                    {connectionStatus.toLowerCase().includes("timed out") ||
                    connectionStatus.toLowerCase().includes("error")
                        ? connectionStatus
                        : `resolving round ${Math.min(lastRoundResult?.round || round || 1, 5)}...`}
                </p>
            </SketchSurface>
        );
    }

    // Game Over state
    if (gamePhase === "game_over") {
        const verdictTitle =
            matchWinner === "user"
                ? "victory"
                : matchWinner === "opponent"
                  ? "defeat"
                  : "draw";
        const verdictClass =
            matchWinner === "user"
                ? "win"
                : matchWinner === "opponent"
                  ? "loss"
                  : "draw";
        const cardFill =
            matchWinner === "user"
                ? "#4ECDC4"
                : matchWinner === "opponent"
                  ? "#F9A8B8"
                  : "#FFE566";

        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="duel-gameover-motion"
            >
                <SketchSurface
                    fill={cardFill}
                    shadow={6}
                    radius={20}
                    seed="duel-gameover"
                    className="duel-sketch-card"
                    innerClassName={`duel-stage-inner duel-gameover verdict-${verdictClass}`}
                >
                    <div className={`duel-trophy-badge ${verdictClass}`}>
                        {matchWinner === "opponent" ? (
                            <ShieldAlert size={22} strokeWidth={2.4} color="#111111" />
                        ) : (
                            <Trophy size={22} strokeWidth={2.4} color="#111111" />
                        )}
                    </div>
                    <span className="duel-phase-chip chip-white">match complete</span>
                    <h2 className={`duel-verdict-title ${verdictClass}`}>{verdictTitle}</h2>
                    <div className="duel-final-score">
                        <span>{scores.user}</span>
                        <span className="score-dash">-</span>
                        <span>{scores.opponent}</span>
                    </div>
                    <p className="duel-subcopy">
                        vs {opponentNickname || "stranger"}
                    </p>
                    <SketchButton
                        fill="#FFFFFF"
                        onPastel={true}
                        shadow={4}
                        radius={12}
                        seed="duel-next-opp"
                        onClick={onNextOpponent}
                        faceClassName="duel-primary-cta-face"
                    >
                        <span>next opponent</span>
                    </SketchButton>
                </SketchSurface>
            </motion.div>
        );
    }

    // Round Break: Hand-Drawn Colorful 3D Animated Clash Arena
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
                initial: { x: -dir * 28, scale: 0.88, opacity: 0 },
                animate: {
                    x: [-dir * 24, dir * 10, -dir * 4],
                    scale: [0.9, 1.06, 1],
                    opacity: 1,
                },
                transition: { duration: 0.72, times: [0, 0.42, 1], ease: "easeOut" as const },
            };
        }

        if (isWinner) {
            if (clashType === "rock_breaks_scissors") {
                return {
                    initial: { x: -dir * 32, scale: 0.86, opacity: 0 },
                    animate: {
                        x: [-dir * 24, -dir * 30, dir * 22, dir * 10],
                        scale: [0.92, 0.96, 1.22, 1.1],
                        rotateZ: [0, -dir * 8, dir * 4, 0],
                        opacity: 1,
                    },
                    transition: { duration: 0.82, times: [0, 0.2, 0.44, 1], ease: "easeOut" as const },
                };
            }
            if (clashType === "paper_wraps_rock") {
                return {
                    initial: { x: -dir * 28, scale: 0.88, opacity: 0 },
                    animate: {
                        x: [-dir * 20, dir * 20, dir * 10],
                        scale: [0.94, 1.22, 1.1],
                        opacity: 1,
                    },
                    transition: { duration: 0.8, times: [0, 0.46, 1], ease: "easeOut" as const },
                };
            }
            if (clashType === "scissors_cuts_paper") {
                return {
                    initial: { x: -dir * 30, scale: 0.88, opacity: 0 },
                    animate: {
                        x: [-dir * 22, dir * 22, dir * 10],
                        scale: [0.94, 1.18, 1.08],
                        rotateZ: [0, -dir * 14, dir * 6, 0],
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
                        opacity: [1, 1, 0.52],
                    },
                    transition: { duration: 0.85, times: [0, 0.34, 1], ease: "easeOut" as const },
                };
            }
            if (clashType === "paper_wraps_rock") {
                return {
                    initial: { x: -dir * 20, scale: 0.95, opacity: 0 },
                    animate: {
                        x: [-dir * 12, -dir * 10, -dir * 18],
                        scale: [1, 0.98, 0.7],
                        opacity: [1, 1, 0.52],
                    },
                    transition: { duration: 0.85, times: [0, 0.36, 1], ease: "easeOut" as const },
                };
            }
            return {
                initial: { x: -dir * 18, scale: 0.92, opacity: 0 },
                animate: { x: -dir * 14, scale: 0.82, opacity: 0.55 },
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
            ? `round ${lastRoundResult?.round || round} won`
            : winner === "opponent"
              ? `round ${lastRoundResult?.round || round} lost`
              : `round ${lastRoundResult?.round || round} tied`;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={roundKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="duel-clash-root"
            >
                <SketchSurface
                    fill={neutralCardFill}
                    shadow={5}
                    radius={20}
                    seed={`clash-${roundKey}`}
                    className="duel-sketch-card clash-card-overflow"
                    innerClassName={`duel-stage-inner duel-clash outcome-${winner}`}
                >
                    <span className={`duel-verdict-pill outcome-${winner}`}>
                        {verdictText}
                    </span>

                    {/* 3D Hand-Drawn Sketch Clash Arena */}
                    <div className="clash-3d-viewport">
                        {/* Hand-drawn oval ground hatch shadow */}
                        <svg
                            className="clash-ground-sketch"
                            width="180"
                            height="32"
                            viewBox="0 0 180 32"
                            aria-hidden="true"
                        >
                            <path
                                d="M12 18 C45 10, 135 10, 168 18 C142 26, 38 26, 12 18 Z"
                                fill={
                                    winner === "user"
                                        ? "#4ECDC4"
                                        : winner === "opponent"
                                          ? "#F9A8B8"
                                          : "#C4B5FD"
                                }
                                fillOpacity="0.45"
                                stroke={ink}
                                strokeWidth="1.8"
                                strokeDasharray="6 5"
                            />
                        </svg>

                        {/* Spiky comic impact starburst on collision */}
                        <motion.div
                            className="clash-starburst-wrap"
                            initial={{ scale: 0.2, opacity: 0, rotate: -15 }}
                            animate={{
                                scale: [0.25, 1.25, 1.05],
                                opacity: [0, 1, 0],
                                rotate: [-12, 8, 16],
                            }}
                            transition={{ duration: 0.65, delay: 0.24, ease: "easeOut" }}
                            aria-hidden="true"
                        >
                            <svg width="92" height="92" viewBox="0 0 100 100">
                                <path
                                    d="M50 6 L61 30 L88 18 L73 43 L96 56 L70 64 L80 90 L54 74 L40 95 L34 69 L8 72 L26 51 L6 35 L33 34 L25 10 Z"
                                    fill="#FFE566"
                                    stroke="#111111"
                                    strokeWidth="2.8"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </motion.div>

                        {/* Hand-drawn lasso wrap ring for Paper beats Rock */}
                        {clashType === "paper_wraps_rock" && (
                            <motion.div
                                className={`clash-wrap-ring side-${winner === "user" ? "right" : "left"}`}
                                initial={{ scale: 1.45, opacity: 0 }}
                                animate={{ scale: [1.45, 0.94, 0.86], opacity: [0, 1, 0.7] }}
                                transition={{ duration: 0.68, delay: 0.26, ease: "easeOut" }}
                                aria-hidden="true"
                            >
                                <svg width="96" height="96" viewBox="0 0 100 100">
                                    <path
                                        d="M52 10 C77 8, 92 28, 90 52 C88 78, 69 91, 46 89 C22 87, 9 69, 11 45 C13 22, 31 12, 52 10 Z"
                                        fill="none"
                                        stroke="#4ECDC4"
                                        strokeWidth="5"
                                        strokeDasharray="10 6"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M52 10 C77 8, 92 28, 90 52 C88 78, 69 91, 46 89 C22 87, 9 69, 11 45 C13 22, 31 12, 52 10 Z"
                                        fill="none"
                                        stroke="#111111"
                                        strokeWidth="2"
                                        strokeDasharray="10 6"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </motion.div>
                        )}

                        {/* Jagged comic slash stroke for Scissors beats Paper */}
                        {clashType === "scissors_cuts_paper" && (
                            <motion.div
                                className={`clash-slash-beam side-${winner === "user" ? "right" : "left"}`}
                                initial={{ scaleX: 0, opacity: 0 }}
                                animate={{ scaleX: [0, 1.2, 0.9, 0], opacity: [0, 1, 1, 0] }}
                                transition={{ duration: 0.55, delay: 0.26, ease: "easeOut" }}
                                aria-hidden="true"
                            >
                                <svg width="116" height="24" viewBox="0 0 120 24">
                                    <path
                                        d="M4 16 L36 6 L68 15 L116 4 L72 19 L34 11 Z"
                                        fill="#FFE566"
                                        stroke="#111111"
                                        strokeWidth="2.4"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </motion.div>
                        )}

                        <div className="clash-hands-row">
                            {/* Left Hand (YOU) */}
                            <div className="clash-hand-slot slot-left">
                                {leftIsCutPaper ? (
                                    <div className="split-paper-wrapper">
                                        <motion.div
                                            className="split-half"
                                            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                                            animate={{ x: -12, y: -18, rotate: -16, opacity: 0.6 }}
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
                                            animate={{ x: -14, y: 18, rotate: 18, opacity: 0.55 }}
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
                                                style={{ backgroundColor: s.color }}
                                                initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.6 }}
                                                animate={{
                                                    x: -s.x,
                                                    y: s.y,
                                                    rotate: s.r,
                                                    opacity: [0, 1, 0],
                                                    scale: [0.6, 1.2, 0.4],
                                                }}
                                                transition={{ duration: 0.65, delay: s.delay, ease: "easeOut" }}
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
                                            animate={{ x: 12, y: -18, rotate: 16, opacity: 0.6 }}
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
                                            animate={{ x: 14, y: 18, rotate: -18, opacity: 0.55 }}
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
                                                style={{ backgroundColor: s.color }}
                                                initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.6 }}
                                                animate={{
                                                    x: s.x,
                                                    y: s.y,
                                                    rotate: s.r,
                                                    opacity: [0, 1, 0],
                                                    scale: [0.6, 1.2, 0.4],
                                                }}
                                                transition={{ duration: 0.65, delay: s.delay, ease: "easeOut" }}
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
                                {userMove === "none" ? "none" : userMove}
                            </span>
                            <span className="move-vs">vs</span>
                            <span className={`move-label role-${oppRole}`}>
                                {oppMove === "none" ? "none" : oppMove}
                            </span>
                        </div>
                        {lastRoundResult?.reason && (
                            <p className="clash-reason">{lastRoundResult.reason}</p>
                        )}
                        <div className="clash-next-timer">
                            next round in <strong>{timer}s</strong>
                        </div>
                    </div>
                </SketchSurface>
            </motion.div>
        </AnimatePresence>
    );
};

export default DuelClashStage;
