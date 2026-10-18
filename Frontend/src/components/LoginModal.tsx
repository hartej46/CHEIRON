import React, { useState } from "react";
import type { PlayerProfile } from "../store/player";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: PlayerProfile | null;
    isLoggedin: boolean;
    onInitiateLogin: (nickname?: string) => Promise<void>;
    onLogout: () => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
    isOpen,
    onClose,
    userData,
    isLoggedin,
    onInitiateLogin,
    onLogout,
}) => {
    const [customNickname, setCustomNickname] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const currentNickname = customNickname ?? (userData?.nickname || "");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onInitiateLogin(currentNickname.trim() || undefined);
            setCustomNickname(null);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await onLogout();
            setCustomNickname("");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose} role="presentation">
            <div
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="modal-header">
                    <div>
                        <h2 id="modal-title" className="modal-heading">
                            Guest Session
                        </h2>
                        <p className="modal-sub">
                            {isLoggedin
                                ? "Manage your current guest identity and session"
                                : "Initiate a guest profile to start connecting"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="modal-close-btn"
                        aria-label="Close dialog"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label htmlFor="nickname-input" className="form-label">
                            Nickname / Handle
                        </label>
                        <input
                            id="nickname-input"
                            type="text"
                            value={currentNickname}
                            onChange={(e) => setCustomNickname(e.target.value)}
                            placeholder="e.g. Satoshi or Stranger_42"
                            className="form-input"
                            autoComplete="off"
                            maxLength={24}
                        />
                        <span className="form-hint">
                            Displayed to partners when connected.
                        </span>
                    </div>

                    {isLoggedin && userData && (
                        <div className="session-meta-panel">
                            <div className="meta-row">
                                <span className="meta-key">User ID</span>
                                <span className="meta-val font-mono">{userData.id}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-key">Initiated</span>
                                <span className="meta-val font-mono">
                                    {new Date(userData.initiatedAt).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-key">Status</span>
                                <span className="meta-val meta-status-active">Active Session</span>
                            </div>
                        </div>
                    )}

                    <div className="modal-actions-bar">
                        {isLoggedin && (
                            <button
                                type="button"
                                onClick={handleLogout}
                                disabled={loading}
                                className="btn-minimal btn-minimal-danger"
                            >
                                Clear Session
                            </button>
                        )}
                        <div className="modal-right-actions">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-minimal btn-minimal-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-minimal btn-minimal-primary"
                            >
                                {loading
                                    ? "Connecting..."
                                    : isLoggedin
                                    ? "Save Changes"
                                    : "Initiate Session"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginModal;
