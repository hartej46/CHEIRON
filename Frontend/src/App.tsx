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
import { clearSession } from "./service/service";

function RoomRoute() {
    const { nickname } = useNickname();

    return nickname ? <VideoRoom /> : <Navigate to="/" replace />;
}

function LandingRoute({ onStart }: { onStart: (nickname: string) => void }) {
    return <LandingPage onStart={onStart} />;
}

function AppRoutes() {
    const navigate = useNavigate();
    const { setNickname } = useNickname();

    useEffect(() => {
        setNickname("");
        void clearSession().catch(() => {
            // There may be no session on the first visit.
        });
    }, [setNickname]);

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
