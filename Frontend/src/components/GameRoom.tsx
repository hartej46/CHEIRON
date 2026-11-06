import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { io, type Socket } from "socket.io-client";

type GameStatus = "waiting" | "countdown" | "evaluation" | "finished";

interface Scores {
    player1: number;
    player2: number;
}

interface RoundData {
    p1_move: string;
    p2_move: string;
    result: string;
}

interface GameRoomProps {
    roomId: string;
}

interface RoundStartPayload {
    round: number;
    durationMs: number;
}

interface RoundResultsPayload extends RoundData {
    p1_score: number;
    p2_score: number;
}

interface GameOverPayload {
    winner: string;
    p1_final_score: number;
    p2_final_score: number;
}

const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const HAND_HIGHLIGHT_LANDMARKS = [0, 4, 8, 12, 16, 20];

const formatMove = (move: string) =>
    move ? move.charAt(0).toUpperCase() + move.slice(1).toLowerCase() : "Unknown";

export function GameRoom({ roomId }: GameRoomProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const latestCoordinatesRef = useRef<number[][] | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const readySentRef = useRef(false);

    const [gameStatus, setGameStatus] = useState<GameStatus>("waiting");
    const [scores, setScores] = useState<Scores>({ player1: 0, player2: 0 });
    const [round, setRound] = useState(0);
    const [timer, setTimer] = useState(0);
    const [roundData, setRoundData] = useState<RoundData | null>(null);
    const [matchWinner, setMatchWinner] = useState("");
    const [toast, setToast] = useState<string | null>(null);
    const [mediaReady, setMediaReady] = useState(false);

    useEffect(() => {
        const socket = io(import.meta.env.VITE_BACKEND_URL);
        socketRef.current = socket;

        const handleRoundStart = ({ round: nextRound }: RoundStartPayload) => {
            setRound(nextRound);
            setGameStatus("countdown");
            setTimer(7);
            setRoundData(null);
        };

        const handleRoundResults = (data: RoundResultsPayload) => {
            setScores({ player1: data.p1_score, player2: data.p2_score });
            setRoundData(data);
            setGameStatus("evaluation");
            setTimer(0);
        };

        const handleGameOver = (data: GameOverPayload) => {
            setScores({
                player1: data.p1_final_score,
                player2: data.p2_final_score,
            });
            setMatchWinner(data.winner);
            setGameStatus("finished");
        };

        const handleLegacyGameOver = (data: {
            winner: string;
            p1_score: number;
            p2_score: number;
        }) => {
            handleGameOver({
                winner: data.winner,
                p1_final_score: data.p1_score,
                p2_final_score: data.p2_score,
            });
        };

        const handleRoundError = ({ message }: { message: string }) => {
            console.error("Round error:", message);
            setToast(message || "Something went wrong with this round.");
        };

        socket.on("round_start", handleRoundStart);
        socket.on("roundResults", handleRoundResults);
        socket.on("game_over", handleGameOver);
        socket.on("match_finished", handleLegacyGameOver);
        socket.on("round_error", handleRoundError);

        return () => {
            socket.off("round_start", handleRoundStart);
            socket.off("roundResults", handleRoundResults);
            socket.off("game_over", handleGameOver);
            socket.off("match_finished", handleLegacyGameOver);
            socket.off("round_error", handleRoundError);
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timeout = window.setTimeout(() => setToast(null), 4000);
        return () => window.clearTimeout(timeout);
    }, [toast]);

    useEffect(() => {
        let cancelled = false;

        const initializeMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;

                const vision = await FilesetResolver.forVisionTasks(
                    `${window.location.origin}/wasm`
                );
                const landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    },
                    runningMode: "VIDEO",
                    numHands: 1,
                });

                if (cancelled) {
                    landmarker.close();
                    return;
                }

                landmarkerRef.current = landmarker;
                setMediaReady(true);
            } catch (error) {
                console.error("Unable to initialize webcam or MediaPipe.", error);
                setToast("Camera and hand tracking are required to play.");
            }
        };

        void initializeMedia();

        return () => {
            cancelled = true;
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            landmarkerRef.current?.close();
            landmarkerRef.current = null;
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mediaReady || readySentRef.current || !socketRef.current) return;
        readySentRef.current = true;
        socketRef.current.emit("client_ready", roomId);
    }, [mediaReady, roomId]);

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!video || !canvas || !context || !mediaReady) return;

        const detectFrame = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.clearRect(0, 0, canvas.width, canvas.height);

                try {
                    const result = landmarkerRef.current?.detectForVideo(
                        video,
                        performance.now()
                    );
                    const landmarks = result?.landmarks[0];
                    latestCoordinatesRef.current = landmarks
                        ? landmarks.map(({ x, y, z }) => [x, y, z])
                        : null;

                    if (landmarks) {
                        context.strokeStyle = "#67e8f9";
                        context.fillStyle = "#ffffff";
                        context.lineWidth = 3;
                        context.lineCap = "round";
                        context.lineJoin = "round";

                        for (const [start, end] of HAND_CONNECTIONS) {
                            const startLandmark = landmarks[start];
                            const endLandmark = landmarks[end];
                            if (!startLandmark || !endLandmark) continue;
                            context.beginPath();
                            context.moveTo(
                                startLandmark.x * canvas.width,
                                startLandmark.y * canvas.height
                            );
                            context.lineTo(
                                endLandmark.x * canvas.width,
                                endLandmark.y * canvas.height
                            );
                            context.stroke();
                        }

                        for (const index of HAND_HIGHLIGHT_LANDMARKS) {
                            const landmark = landmarks[index];
                            if (!landmark) continue;
                            context.beginPath();
                            context.arc(
                                landmark.x * canvas.width,
                                landmark.y * canvas.height,
                                5,
                                0,
                                Math.PI * 2
                            );
                            context.fill();
                        }
                    }
                } catch (error) {
                    console.error("MediaPipe hand detection failed.", error);
                }
            }

            animationFrameRef.current = requestAnimationFrame(detectFrame);
        };

        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            context.clearRect(0, 0, canvas.width, canvas.height);
        };
    }, [mediaReady]);

    useEffect(() => {
        if (gameStatus !== "countdown") return;
        const interval = window.setInterval(() => {
            setTimer((currentTimer) => Math.max(currentTimer - 1, 0));
        }, 1000);
        return () => window.clearInterval(interval);
    }, [gameStatus, round]);

    useEffect(() => {
        if (gameStatus !== "countdown" || timer !== 0) return;
        const coordinates = latestCoordinatesRef.current;
        if (coordinates && socketRef.current) {
            socketRef.current.emit("submit_coordinates", {
                roomId,
                coordinates: [coordinates, coordinates, coordinates, coordinates, coordinates],
            });
        }
    }, [gameStatus, timer, roomId]);

    return (
        <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-8">
            <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col gap-6">
                <header className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                        <p className="text-sm text-slate-400">Rock Paper Scissors</p>
                        <h1 className="text-2xl font-semibold">Round {round || "—"}</h1>
                    </div>
                    <div className="flex items-center gap-4 text-center">
                        <div>
                            <p className="text-xs text-slate-400">Player 1</p>
                            <p className="text-2xl font-bold">{scores.player1}</p>
                        </div>
                        <span className="text-slate-600">:</span>
                        <div>
                            <p className="text-xs text-slate-400">Player 2</p>
                            <p className="text-2xl font-bold">{scores.player2}</p>
                        </div>
                    </div>
                </header>

                <section className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
                    <div className="relative aspect-video w-full max-w-4xl">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="h-full w-full -scale-x-100 object-cover"
                        />
                        <canvas
                            ref={canvasRef}
                            aria-hidden="true"
                            className="absolute top-0 left-0 h-full w-full -scale-x-100"
                        />
                        {gameStatus === "evaluation" && roundData && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-6 text-center">
                                <p className="text-lg font-medium sm:text-2xl">
                                    You threw {formatMove(roundData.p1_move)}, opponent threw{" "}
                                    {formatMove(roundData.p2_move)}
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                <footer className="min-h-16 text-center">
                    {gameStatus === "waiting" && (
                        <p className="text-slate-400">Waiting for opponent...</p>
                    )}
                    {gameStatus === "countdown" && (
                        <p className="text-5xl font-bold tabular-nums">{timer}</p>
                    )}
                    {gameStatus === "evaluation" && roundData && (
                        <p className="text-slate-300">{formatMove(roundData.result)}</p>
                    )}
                    {gameStatus === "finished" && (
                        <p className="text-2xl font-bold sm:text-4xl">
                            GAME OVER - Winner: {matchWinner}
                        </p>
                    )}
                </footer>
            </div>
            {toast && (
                <div
                    className="fixed right-4 bottom-4 rounded-lg bg-red-500 px-4 py-3 text-sm text-white shadow-lg"
                    role="alert"
                >
                    {toast}
                </div>
            )}
        </main>
    );
}

export default GameRoom;
