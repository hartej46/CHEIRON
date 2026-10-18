import React from "react";
import type { PlayerProfile } from "../store/player";

interface NavbarProps {
    userData: PlayerProfile | null;
    isLoggedin: boolean;
    onOpenAuthModal: () => void;
    isCameraActive: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
    userData,
    isLoggedin,
    onOpenAuthModal,
    isCameraActive,
}) => {
    return (
        <header className="brand-navbar">
            <div className="brand-logo-group">
                <span className="brand-title">CHEIRON</span>
                <span className="brand-divider">/</span>
                <span className="brand-subtitle">minimalist video</span>
            </div>

            <div className="brand-nav-right">
                <div className="status-indicator-pill">
                    <span
                        className={`status-dot ${isCameraActive ? "status-dot-active" : "status-dot-idle"}`}
                    />
                    <span className="status-text">
                        {isCameraActive ? "Camera Live" : "Camera Idle"}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="user-profile-button"
                    title={isLoggedin ? "View Session Details" : "Log In / Initiate Session"}
                >
                    <span className="user-avatar-dot" />
                    <span className="user-nickname">
                        {isLoggedin && userData ? userData.nickname : "Log In as Guest"}
                    </span>
                </button>
            </div>
        </header>
    );
};

export default Navbar;
