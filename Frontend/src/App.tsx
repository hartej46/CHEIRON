import { useCallback, useEffect, useMemo, useState } from "react";
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
    useNavigate,
} from "react-router-dom";
import "./App.css";
import {
    NicknameContext,
    useNickname,
} from "./context/NicknameContext";
import { LandingPage } from "./pages/LandingPage";
import { VideoRoom } from "./pages/VideoRoom";
import {
    clearSession,
    getSessionDetails,
    initPlayer,
    type GuestProfile,
} from "./service/service";

function RoomRoute() {
    const { nickname, isCheckingSession } = useNickname();

    if (isCheckingSession) {
        return (
            <main className="landing-page">
                <section className="landing-card" aria-busy="true">
                    <p className="eyebrow">CHEIRON / VIDEO CHAT</p>
                    <p className="landing-copy">Checking session...</p>
                </section>
            </main>
        );
    }

    return nickname ? <VideoRoom /> : <Navigate to="/" replace />;
}

function LandingRoute({ onStart }: { onStart: (nickname: string) => void }) {
    return <LandingPage onStart={onStart} />;
}

function AppRoutes() {
    const navigate = useNavigate();
    const { setNickname } = useNickname();

    const handleStart = (startedNickname: string) => {
        setNickname(startedNickname);
        navigate("/room");
    };

    return (
        <Routes>
            <Route path="/" element={<LandingRoute onStart={handleStart} />} />
            <Route path="/room" element={<RoomRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    const [nickname, setNickname] = useState("");
    const [userData, setUserData] = useState<GuestProfile | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    const refreshSession = useCallback(async (): Promise<GuestProfile | null> => {
        try {
            const response = await getSessionDetails();
            if (response && response.profile) {
                setUserData(response.profile);
                setNickname(response.profile.nickname);
                setIsLoggedIn(true);
                return response.profile;
            } else {
                setUserData(null);
                setNickname("");
                setIsLoggedIn(false);
                return null;
            }
        } catch {
            setUserData(null);
            setNickname("");
            setIsLoggedIn(false);
            return null;
        } finally {
            setIsCheckingSession(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        getSessionDetails()
            .then((response) => {
                if (!isMounted) return;
                if (response?.profile) {
                    setUserData(response.profile);
                    setNickname(response.profile.nickname);
                    setIsLoggedIn(true);
                } else {
                    setUserData(null);
                    setNickname("");
                    setIsLoggedIn(false);
                }
            })
            .catch(() => {
                if (!isMounted) return;
                setUserData(null);
                setNickname("");
                setIsLoggedIn(false);
            })
            .finally(() => {
                if (isMounted) {
                    setIsCheckingSession(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const updateUsername = useCallback(async (newNickname: string) => {
        const trimmed = newNickname.trim();
        if (trimmed.length <= 2) {
            throw new Error("Username must be greater than 2 characters.");
        }
        const response = await initPlayer(trimmed);
        if (response && response.profile) {
            setUserData(response.profile);
            setNickname(response.profile.nickname);
            setIsLoggedIn(true);
        }
    }, []);

    const deleteUserId = useCallback(async () => {
        await clearSession();
        setUserData(null);
        setNickname("");
        setIsLoggedIn(false);
    }, []);

    const contextValue = useMemo(
        () => ({
            nickname,
            setNickname,
            userData,
            setUserData,
            isLoggedIn,
            isCheckingSession,
            updateUsername,
            deleteUserId,
            refreshSession,
        }),
        [
            nickname,
            userData,
            isLoggedIn,
            isCheckingSession,
            updateUsername,
            deleteUserId,
            refreshSession,
        ]
    );

    return (
        <NicknameContext.Provider value={contextValue}>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </NicknameContext.Provider>
    );
}

export default App;

