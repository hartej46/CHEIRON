import { useEffect, useMemo, useState } from "react";
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
import { getSessionDetails } from "./service/service";

function RoomRoute() {
    const { nickname } = useNickname();

    return nickname ? <VideoRoom /> : <Navigate to="/" replace />;
}

function LandingRoute({ onStart }: { onStart: (nickname: string) => void }) {
    const { nickname } = useNickname();

    return nickname ? <Navigate to="/room" replace /> : <LandingPage onStart={onStart} />;
}

function AppRoutes() {
    const navigate = useNavigate();
    const { setNickname } = useNickname();
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            try {
                const response = await getSessionDetails();
                if (isMounted && response?.profile?.nickname) {
                    setNickname(response.profile.nickname);
                    if (window.location.pathname === "/") {
                        navigate("/room", { replace: true });
                    }
                }
            } catch {
                // If false or error came, automatically proceed to adding nickname on landing page
            } finally {
                if (isMounted) {
                    setIsCheckingSession(false);
                }
            }
        };

        checkSession();

        return () => {
            isMounted = false;
        };
    }, [navigate, setNickname]);

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

    const handleStart = (nickname: string) => {
        setNickname(nickname);
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
    const contextValue = useMemo(
        () => ({ nickname, setNickname }),
        [nickname]
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
