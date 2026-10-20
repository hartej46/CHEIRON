import { useMemo, useState } from "react";
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
import { initPlayer } from "./service/service";
import { VideoScreen } from "./components/VideoScreen";
import { LandingPage } from "./pages/LandingPage";

function RoomRoute() {
    const { nickname } = useNickname();
    const [isLoggedin, setIsLoggedin] = useState(false);

    if (!nickname) return <Navigate to="/" replace />;

    const ensureLoggedIn = async () => {
        await initPlayer(nickname);
        setIsLoggedin(true);
    };

    return (
        <VideoScreen
            onEnsureLoggedIn={ensureLoggedIn}
            isLoggedin={isLoggedin}
            userNickname={nickname}
        />
    );
}

function AppRoutes() {
    const navigate = useNavigate();
    const { setNickname } = useNickname();

    const handleStart = (nickname: string) => {
        setNickname(nickname);
        navigate("/room");
    };

    return (
        <Routes>
            <Route path="/" element={<LandingPage onStart={handleStart} />} />
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
