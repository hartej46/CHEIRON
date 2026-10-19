import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { Navbar, VideoScreen, LoginModal } from "./components";
import { initPlayer, clearSession } from "./service/service";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { fetchUser, login, logout } from "./store/player";

function App() {
    const dispatch = useAppDispatch();
    const { userData, isLoggedin, isCheckingSession, error } = useAppSelector(
        (state) => state.auth
    );

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // Initial session check on mount via getSessionDetails service thunk
    useEffect(() => {
        dispatch(fetchUser());
    }, [dispatch]);

    // Function to initiate user login via service
    const handleInitiateUser = useCallback(
        async (customNickname?: string) => {
            setActionError(null);
            try {
                const res = await initPlayer(customNickname);
                if (res.success && res.profile) {
                    dispatch(login(res.profile));
                }
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Unable to connect to server. Please refresh your page.";
                setActionError(message);
            }
        },
        [dispatch]
    );

    // Function to clear user session
    const handleLogout = useCallback(async () => {
        try {
            await clearSession();
            dispatch(logout());
        } catch (err: unknown) {
            console.error("Logout failed:", err);
            dispatch(logout());
        }
    }, [dispatch]);

    const handleRefreshPage = () => {
        window.location.reload();
    };

    return (
        <div className="cheiron-app-root">
            {/* Minimalist Top Navigation */}
            <Navbar
                userData={userData}
                isLoggedin={isLoggedin}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                isCameraActive={isCameraActive}
            />

            {/* Error Banner when server connection fails */}
            {(actionError || (error && !isLoggedin && !isCheckingSession)) && (
                <div className="minimal-error-banner" role="alert">
                    <span className="error-icon">✕</span>
                    <span className="error-text">
                        {actionError ||
                            error ||
                            "Unable to connect to server. Please refresh your page."}
                    </span>
                    <button
                        type="button"
                        onClick={handleRefreshPage}
                        className="btn-minimal btn-minimal-secondary btn-small"
                    >
                        Refresh Page
                    </button>
                    <button
                        type="button"
                        onClick={() => handleInitiateUser()}
                        className="btn-minimal btn-minimal-primary btn-small"
                    >
                        Retry Log In
                    </button>
                </div>
            )}

            {/* Main Stage */}
            <div className="app-stage-wrapper">
                {isCheckingSession && !userData ? (
                    <div className="minimal-page-loader">
                        <div className="minimal-spinner" />
                        <span className="loader-label">Connecting to server...</span>
                    </div>
                ) : (
                    <VideoScreen
                        isLoggedin={isLoggedin}
                        userNickname={userData?.nickname}
                        onEnsureLoggedIn={() => handleInitiateUser()}
                        onCameraActiveChange={setIsCameraActive}
                    />
                )}
            </div>

            {/* Minimalist Guest Session / Profile Modal */}
            <LoginModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                userData={userData}
                isLoggedin={isLoggedin}
                onInitiateLogin={handleInitiateUser}
                onLogout={handleLogout}
            />
        </div>
    );
}

export default App;
