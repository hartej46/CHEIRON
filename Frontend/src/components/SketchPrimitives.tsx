import React, { useLayoutEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

/**
 * Deterministic PRNG (Mulberry32) so every hand-drawn shape stays stable
 * across re-renders while looking uniquely sketched by hand.
 */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashSeed(input: number | string): number {
    if (typeof input === "number") return Math.floor(input * 997) || 42;
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * Generates an organic hand-drawn closed rectangle/pill path in 1:1 pixel space.
 * No straight horizontal or vertical segments are emitted: every edge gently
 * bows and wobbles with deterministic pencil variation.
 */
export function buildSketchRectPath(
    w: number,
    h: number,
    radius = 12,
    seedInput: number | string = 1,
    bow = 1.6
): { mainPath: string; secondaryPath: string } {
    if (w < 4 || h < 4) {
        return { mainPath: "", secondaryPath: "" };
    }

    const rand = mulberry32(hashSeed(seedInput) ^ Math.round(w * 13 + h * 7));
    const jit = (mag: number) => (rand() - 0.5) * 2 * mag;

    const r = Math.min(radius, w * 0.45, h * 0.45);
    const pad = 1.5;
    const x0 = pad;
    const y0 = pad;
    const x1 = w - pad;
    const y1 = h - pad;

    const rTL = Math.max(2, r + jit(1.4));
    const rTR = Math.max(2, r + jit(1.4));
    const rBR = Math.max(2, r + jit(1.4));
    const rBL = Math.max(2, r + jit(1.4));

    const pTL1 = [x0 + jit(0.75), y0 + rTL + jit(0.65)];
    const pTL2 = [x0 + rTL + jit(0.65), y0 + jit(0.75)];

    const pTR1 = [x1 - rTR + jit(0.65), y0 + jit(0.75)];
    const pTR2 = [x1 + jit(0.75), y0 + rTR + jit(0.65)];

    const pBR1 = [x1 + jit(0.75), y1 - rBR + jit(0.65)];
    const pBR2 = [x1 - rBR + jit(0.65), y1 + jit(0.75)];

    const pBL1 = [x0 + rBL + jit(0.65), y1 + jit(0.75)];
    const pBL2 = [x0 + jit(0.75), y1 - rBL + jit(0.65)];

    const edgeCurve = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
        const sign1 = rand() > 0.5 ? 0.55 : -0.55;
        const sign2 = rand() > 0.5 ? -0.45 : 0.45;
        const mx1 = ax + (bx - ax) * 0.34 + nx * (jit(bow) + sign1);
        const my1 = ay + (by - ay) * 0.34 + ny * (jit(bow) + sign1);
        const mx2 = ax + (bx - ax) * 0.67 + nx * (jit(bow * 0.85) + sign2);
        const my2 = ay + (by - ay) * 0.67 + ny * (jit(bow * 0.85) + sign2);
        return `C ${mx1.toFixed(1)},${my1.toFixed(1)} ${mx2.toFixed(1)},${my2.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
    };

    const mainPath = [
        `M ${pTL2[0].toFixed(1)},${pTL2[1].toFixed(1)}`,
        edgeCurve(pTL2[0], pTL2[1], pTR1[0], pTR1[1], 0, 1),
        `Q ${(x1 + jit(0.9)).toFixed(1)},${(y0 + jit(0.9)).toFixed(1)} ${pTR2[0].toFixed(1)},${pTR2[1].toFixed(1)}`,
        edgeCurve(pTR2[0], pTR2[1], pBR1[0], pBR1[1], 1, 0),
        `Q ${(x1 + jit(0.9)).toFixed(1)},${(y1 + jit(0.9)).toFixed(1)} ${pBR2[0].toFixed(1)},${pBR2[1].toFixed(1)}`,
        edgeCurve(pBR2[0], pBR2[1], pBL1[0], pBL1[1], 0, 1),
        `Q ${(x0 + jit(0.9)).toFixed(1)},${(y1 + jit(0.9)).toFixed(1)} ${pBL2[0].toFixed(1)},${pBL2[1].toFixed(1)}`,
        edgeCurve(pBL2[0], pBL2[1], pTL1[0], pTL1[1], 1, 0),
        `Q ${(x0 + jit(0.9)).toFixed(1)},${(y0 + jit(0.9)).toFixed(1)} ${pTL2[0].toFixed(1)},${pTL2[1].toFixed(1)}`,
        "Z",
    ].join(" ");

    const secTopL = Math.max(0, x0 + rTL * 0.35 - 1.5);
    const secTopR = Math.min(w, x1 - rTR * 0.28 + 1.5);
    const secBotL = Math.max(0, x0 + rBL * 0.38 - 1.5);
    const secBotR = Math.min(w, x1 - rBR * 0.25 + 1.5);
    const secLeftT = Math.max(0, y0 + rTL * 0.45);
    const secLeftB = Math.min(h, y1 - rBL * 0.4);

    const secondaryPath = [
        `M ${secTopL.toFixed(1)},${(y0 + jit(1.1)).toFixed(1)} Q ${(w * 0.5).toFixed(1)},${(y0 + jit(1.7)).toFixed(1)} ${secTopR.toFixed(1)},${(y0 + jit(1.1)).toFixed(1)}`,
        `M ${secBotL.toFixed(1)},${(y1 + jit(1.1)).toFixed(1)} Q ${(w * 0.5).toFixed(1)},${(y1 + jit(1.7)).toFixed(1)} ${secBotR.toFixed(1)},${(y1 + jit(1.1)).toFixed(1)}`,
        h > 70
            ? `M ${(x0 + jit(1.1)).toFixed(1)},${secLeftT.toFixed(1)} Q ${(x0 + jit(1.6)).toFixed(1)},${(h * 0.5).toFixed(1)} ${(x0 + jit(1.1)).toFixed(1)},${secLeftB.toFixed(1)}`
            : "",
    ]
        .filter(Boolean)
        .join(" ");

    return { mainPath, secondaryPath };
}

function useElementSize<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            const w = Math.round(rect.width);
            const h = Math.round(rect.height);
            setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
        };

        update();

        const observer = new ResizeObserver(() => update());
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return { ref, size };
}

interface SketchShapeSvgProps {
    width: number;
    height: number;
    radius?: number;
    seed?: number | string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    bow?: number;
    doubleStroke?: boolean;
    className?: string;
}

export const SketchShapeSvg: React.FC<SketchShapeSvgProps> = ({
    width,
    height,
    radius = 12,
    seed = 1,
    fill = "#ffffff",
    stroke = "#111111",
    strokeWidth = 2.4,
    bow = 1.6,
    doubleStroke = false,
    className = "",
}) => {
    if (width < 4 || height < 4) return null;
    const { mainPath, secondaryPath } = buildSketchRectPath(width, height, radius, seed, bow);

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={`sketch-svg-layer ${className}`}
            aria-hidden="true"
        >
            <path
                d={mainPath}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {doubleStroke && stroke !== "none" && secondaryPath && (
                <path
                    d={secondaryPath}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={Math.max(1, strokeWidth * 0.45)}
                    strokeOpacity={0.34}
                    strokeLinecap="round"
                />
            )}
        </svg>
    );
};

interface SketchSurfaceProps {
    children: React.ReactNode;
    as?: "div" | "section" | "article" | "header" | "footer" | "span";
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    shadow?: number;
    shadowColor?: string;
    onPastel?: boolean;
    radius?: number;
    seed?: number | string;
    bow?: number;
    doubleStroke?: boolean;
    strokeOnTop?: boolean;
    className?: string;
    innerClassName?: string;
    style?: React.CSSProperties;
    role?: string;
    "aria-label"?: string;
    "aria-live"?: "off" | "polite" | "assertive";
}

/**
 * Hand-drawn Neobrutalist card/container with organic wobbly pencil/ink outlines
 * and hard zero-blur offset shadow rendered cleanly behind children.
 */
export const SketchSurface: React.FC<SketchSurfaceProps> = ({
    children,
    as: Tag = "div",
    fill,
    stroke,
    strokeWidth = 2.4,
    shadow = 4,
    shadowColor,
    onPastel = false,
    radius = 14,
    seed = "surface",
    bow = 1.7,
    doubleStroke = true,
    strokeOnTop = false,
    className = "",
    innerClassName = "",
    style,
    role,
    "aria-label": ariaLabel,
    "aria-live": ariaLive,
}) => {
    const { isDark } = useTheme();
    const { ref, size } = useElementSize<HTMLElement>();

    const resolvedFill = fill ?? (isDark ? "#1C1C21" : "#FFFFFF");
    const themeInk = onPastel ? "#111111" : isDark ? "#FFFFFF" : "#111111";
    const resolvedStroke = stroke ?? themeInk;
    const resolvedShadow = shadowColor ?? themeInk;

    return (
        <Tag
            ref={ref as React.Ref<never>}
            className={`sketch-surface-root ${className}`}
            style={{
                ...style,
                ["--sketch-shadow" as string]: `${shadow}px`,
            }}
            role={role}
            aria-label={ariaLabel}
            aria-live={ariaLive}
        >
            {size.width >= 4 && size.height >= 4 && (
                <>
                    {shadow > 0 && (
                        <SketchShapeSvg
                            width={size.width}
                            height={size.height}
                            radius={radius}
                            seed={seed}
                            fill={resolvedShadow}
                            stroke="none"
                            bow={bow}
                            className="sketch-surface-shadow"
                        />
                    )}
                    <SketchShapeSvg
                        width={size.width}
                        height={size.height}
                        radius={radius}
                        seed={seed}
                        fill={resolvedFill}
                        stroke={strokeOnTop ? "none" : resolvedStroke}
                        strokeWidth={strokeWidth}
                        bow={bow}
                        doubleStroke={!strokeOnTop && doubleStroke}
                        className="sketch-surface-bg"
                    />
                    {strokeOnTop && (
                        <SketchShapeSvg
                            width={size.width}
                            height={size.height}
                            radius={radius}
                            seed={seed}
                            fill="none"
                            stroke={resolvedStroke}
                            strokeWidth={strokeWidth}
                            bow={bow}
                            doubleStroke={doubleStroke}
                            className="sketch-surface-top-stroke"
                        />
                    )}
                </>
            )}
            <div className={`sketch-surface-inner ${innerClassName}`}>{children}</div>
        </Tag>
    );
};

interface SketchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    shadow?: number;
    shadowColor?: string;
    onPastel?: boolean;
    radius?: number;
    seed?: number | string;
    bow?: number;
    faceClassName?: string;
}

/**
 * Hand-drawn Neobrutalist button with physical press-down motion into its
 * offset hard ink shadow on hover (+2px, +2px) and active (+4px, +4px).
 */
export const SketchButton: React.FC<SketchButtonProps> = ({
    children,
    fill = "#FFE566",
    stroke,
    strokeWidth = 2.4,
    shadow = 4,
    shadowColor,
    onPastel = false,
    radius = 12,
    seed = "btn",
    bow = 1.4,
    className = "",
    faceClassName = "",
    disabled = false,
    type = "button",
    style,
    ...rest
}) => {
    const { isDark } = useTheme();
    const { ref, size } = useElementSize<HTMLButtonElement>();

    const themeInk = onPastel ? "#111111" : isDark ? "#FFFFFF" : "#111111";
    const resolvedStroke = stroke ?? themeInk;
    const resolvedShadow = shadowColor ?? themeInk;

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled}
            className={`sketch-btn-root ${disabled ? "is-disabled" : ""} ${className}`}
            style={{
                ...style,
                ["--sketch-shadow" as string]: `${shadow}px`,
            }}
            {...rest}
        >
            {shadow > 0 && size.width >= 4 && size.height >= 4 && (
                <SketchShapeSvg
                    width={size.width}
                    height={size.height}
                    radius={radius}
                    seed={seed}
                    fill={resolvedShadow}
                    stroke="none"
                    bow={bow}
                    className="sketch-btn-shadow"
                />
            )}
            <span className={`sketch-btn-face ${faceClassName}`}>
                {size.width >= 4 && size.height >= 4 && (
                    <SketchShapeSvg
                        width={size.width}
                        height={size.height}
                        radius={radius}
                        seed={seed}
                        fill={fill}
                        stroke={resolvedStroke}
                        strokeWidth={strokeWidth}
                        bow={bow}
                        doubleStroke={true}
                        className="sketch-btn-face-svg"
                    />
                )}
                <span className="sketch-btn-content">{children}</span>
            </span>
        </button>
    );
};

interface ThemeToggleButtonProps {
    seed?: string;
    className?: string;
    iconOnly?: boolean;
}

/**
 * Tactile Light/Dark theme switch button styled in hand-drawn Neobrutalism.
 */
export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
    seed = "theme-toggle",
    className = "",
    iconOnly = false,
}) => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <SketchButton
            fill={isDark ? "#FFE566" : "#1C1C21"}
            onPastel={isDark}
            shadow={3}
            radius={999}
            seed={seed}
            onClick={toggleTheme}
            className={`nb-theme-toggle-btn ${className}`}
            faceClassName={`nb-theme-toggle-face ${isDark ? "is-dark" : "is-light"} ${
                iconOnly ? "is-icon-only" : ""
            }`}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
            {isDark ? <Sun size={15} strokeWidth={2.5} /> : <Moon size={15} strokeWidth={2.5} />}
            {!iconOnly && <span>{isDark ? "light" : "dark"}</span>}
        </SketchButton>
    );
};

interface SketchDividerProps {
    orientation?: "vertical" | "horizontal";
    length?: number;
    color?: string;
    strokeWidth?: number;
    variant?: "wobble" | "zigzag";
    className?: string;
}

/**
 * Hand-drawn pencil/ink divider line so zero machine-straight rules appear.
 */
export const SketchDivider: React.FC<SketchDividerProps> = ({
    orientation = "vertical",
    length = 34,
    color,
    strokeWidth = 2.2,
    variant = "zigzag",
    className = "",
}) => {
    const { isDark } = useTheme();
    const resolvedColor = color ?? (isDark ? "#FFFFFF" : "#111111");

    if (orientation === "vertical") {
        const d =
            variant === "zigzag"
                ? `M 6,2 C 10,8 2,14 7,20 C 10,25 3,29 6,${length - 2}`
                : `M 7,2 C 5.5,${(length * 0.35).toFixed(1)} 6.8,${(length * 0.68).toFixed(1)} 5,${length - 2}`;
        return (
            <svg
                width={12}
                height={length}
                viewBox={`0 0 12 ${length}`}
                className={`sketch-divider ${className}`}
                aria-hidden="true"
            >
                <path
                    d={d}
                    fill="none"
                    stroke={resolvedColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }

    const d =
        variant === "zigzag"
            ? `M 2,6 Q ${length * 0.25},2 ${length * 0.5},6 Q ${length * 0.75},10 ${length - 2},5`
            : `M 2,6 Q ${length * 0.5},3 ${length - 2},6`;

    return (
        <svg
            width={length}
            height={12}
            viewBox={`0 0 ${length} 12`}
            className={`sketch-divider ${className}`}
            aria-hidden="true"
        >
            <path
                d={d}
                fill="none"
                stroke={resolvedColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

interface SketchPipProps {
    outcome?: "user" | "opponent" | "draw";
    isCurrent?: boolean;
    index: number;
}

/**
 * Hand-drawn mini sketchbook tally box for each of the 5 rounds.
 */
export const SketchRoundPip: React.FC<SketchPipProps> = ({ outcome, isCurrent, index }) => {
    const { isDark } = useTheme();
    const ink = isDark ? "#FFFFFF" : "#111111";
    const emptyFill = isDark ? "#25252C" : "#FFFFFF";
    const fill =
        outcome === "user"
            ? "#4ECDC4"
            : outcome === "opponent"
              ? "#E8635A"
              : outcome === "draw"
                ? "#C4B5FD"
                : isCurrent
                  ? "#FFE566"
                  : emptyFill;

    const rot = [-3, 2, -1.5, 2.5, -2][index % 5];

    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            className={`sketch-round-pip ${isCurrent ? "is-current" : ""}`}
            style={{ transform: `rotate(${rot}deg)` }}
            aria-hidden="true"
        >
            {/* Tiny offset ink shadow */}
            <path
                d="M5 4 C10 3, 15 3.5, 20 4.5 C21 10, 20.5 15, 19.5 20 C14 21, 9 20.5, 4.5 19.5 C3.5 14, 4 9, 5 4 Z"
                transform="translate(1.8, 1.8)"
                fill={ink}
            />
            {/* Hand-drawn square body */}
            <path
                d="M5 4 C10 3, 15 3.5, 20 4.5 C21 10, 20.5 15, 19.5 20 C14 21, 9 20.5, 4.5 19.5 C3.5 14, 4 9, 5 4 Z"
                fill={fill}
                stroke={ink}
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Win check / Loss cross / Draw dash / Current dot */}
            {outcome === "user" && (
                <path
                    d="M7.5 12.2 L10.6 15.2 L16.8 8.8"
                    fill="none"
                    stroke="#111111"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
            {outcome === "opponent" && (
                <path
                    d="M8.2 8.2 L15.8 15.8 M15.5 8.5 L8.5 15.5"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                />
            )}
            {outcome === "draw" && (
                <path
                    d="M7.5 12.2 Q12 10.8 16.5 12.2"
                    fill="none"
                    stroke="#111111"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                />
            )}
            {isCurrent && !outcome && <circle cx="12" cy="12" r="2.6" fill="#111111" />}
        </svg>
    );
};

/**
 * Hand-drawn pencil squiggle underline for hero highlights.
 */
export const SketchSquiggleUnderline: React.FC<{ color?: string; className?: string }> = ({
    color = "#E8635A",
    className = "",
}) => {
    const { isDark } = useTheme();
    return (
        <svg
            viewBox="0 0 220 18"
            className={`sketch-squiggle-underline ${className}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <path
                d="M4 11 Q 38 3, 74 10 T 146 9 T 216 11"
                fill="none"
                stroke={color}
                strokeWidth="5.5"
                strokeLinecap="round"
            />
            <path
                d="M4 11 Q 38 3, 74 10 T 146 9 T 216 11"
                fill="none"
                stroke={isDark ? "#FFFFFF" : "#111111"}
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
};

/**
 * Scattered Neobrutalism decorative sketchbook doodles: hand-drawn stars,
 * organic pastel blobs, and pencil squiggles anchored safely around corners.
 */
export const SketchArenaDoodles: React.FC<{ variant?: "arena" | "landing" }> = ({
    variant = "arena",
}) => {
    const { isDark } = useTheme();
    const ink = isDark ? "#FFFFFF" : "#111111";

    return (
        <div
            className={variant === "landing" ? "landing-doodles-layer" : "arena-doodles-layer"}
            aria-hidden="true"
        >
            {/* Top-left 4-point hand-drawn yellow star */}
            <svg className="arena-deco deco-star-tl" width="38" height="38" viewBox="0 0 40 40">
                <path
                    d="M20 3 C21.5 14 25 18 37 20 C26 21.5 21.5 25 20 37 C18.5 25 14 21.5 3 20 C14 18 18.5 14 20 3 Z"
                    transform="translate(2.2, 2.2)"
                    fill={ink}
                />
                <path
                    d="M20 3 C21.5 14 25 18 37 20 C26 21.5 21.5 25 20 37 C18.5 25 14 21.5 3 20 C14 18 18.5 14 20 3 Z"
                    fill="#FFE566"
                    stroke={ink}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {/* Top-right pastel pink organic blob */}
            <svg className="arena-deco deco-blob-tr" width="52" height="48" viewBox="0 0 80 76">
                <path
                    d="M41 6 C58 5, 73 19, 72 37 C71 57, 56 70, 38 69 C18 68, 6 54, 7 35 C8 16, 24 7, 41 6 Z"
                    transform="translate(3, 3)"
                    fill={ink}
                />
                <path
                    d="M41 6 C58 5, 73 19, 72 37 C71 57, 56 70, 38 69 C18 68, 6 54, 7 35 C8 16, 24 7, 41 6 Z"
                    fill="#F9A8B8"
                    stroke={ink}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
            </svg>

            {/* Mid lavender diamond sparkle */}
            <svg className="arena-deco deco-spark-cl" width="30" height="30" viewBox="0 0 32 32">
                <path
                    d="M16 3 L19 13 L29 16 L19 19 L16 29 L13 19 L3 16 L13 13 Z"
                    fill="#C4B5FD"
                    stroke={ink}
                    strokeWidth="2.1"
                    strokeLinejoin="round"
                />
            </svg>

            {/* Teal hand-drawn squiggle */}
            <svg className="arena-deco deco-squiggle-cr" width="56" height="26" viewBox="0 0 64 28">
                <path
                    d="M4 18 C11 5, 19 5, 24 16 C29 25, 37 25, 42 14 C47 4, 54 6, 60 15"
                    fill="none"
                    stroke="#4ECDC4"
                    strokeWidth="5"
                    strokeLinecap="round"
                />
                <path
                    d="M4 18 C11 5, 19 5, 24 16 C29 25, 37 25, 42 14 C47 4, 54 6, 60 15"
                    fill="none"
                    stroke={ink}
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>

            {/* Coral pebble */}
            <svg className="arena-deco deco-blob-bl" width="42" height="38" viewBox="0 0 60 56">
                <path
                    d="M18 11 C31 4, 51 11, 53 28 C55 44, 38 51, 21 48 C6 45, 4 21, 18 11 Z"
                    transform="translate(2.5, 2.5)"
                    fill={ink}
                />
                <path
                    d="M18 11 C31 4, 51 11, 53 28 C55 44, 38 51, 21 48 C6 45, 4 21, 18 11 Z"
                    fill="#E8635A"
                    stroke={ink}
                    strokeWidth="2.4"
                />
            </svg>

            {/* Teal 4-point star */}
            <svg className="arena-deco deco-star-br" width="34" height="34" viewBox="0 0 36 36">
                <path
                    d="M18 3 C19.5 13 23 16 33 18 C23 19.5 19.5 23 18 33 C16.5 23 13 19.5 3 18 C13 16 16.5 13 18 3 Z"
                    transform="translate(2, 2)"
                    fill={ink}
                />
                <path
                    d="M18 3 C19.5 13 23 16 33 18 C23 19.5 19.5 23 18 33 C16.5 23 13 19.5 3 18 C13 16 16.5 13 18 3 Z"
                    fill="#4ECDC4"
                    stroke={ink}
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};
