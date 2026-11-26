import React, { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { useNickname } from "../context/NicknameContext";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDeleted?: () => void;
    variant?: "default" | "neobrutal";
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
    isOpen,
    onClose,
    onDeleted,
    variant = "default",
}) => {
    if (!isOpen) return null;

    return (
        <ProfileModalDialog
            onClose={onClose}
            onDeleted={onDeleted}
            variant={variant}
        />
    );
};

const ProfileModalDialog: React.FC<Omit<ProfileModalProps, "isOpen">> = ({
    onClose,
    onDeleted,
    variant = "default",
}) => {
    const { userData, nickname, isLoggedIn, updateUsername, deleteUserId } =
        useNickname();

    const [usernameInput, setUsernameInput] = useState(
        userData?.nickname || nickname || ""
    );
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const handleUpdateUsername = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = usernameInput.trim();

        if (!trimmed) {
            setUpdateError("Please enter a username.");
            setUpdateSuccess(null);
            return;
        }

        if (trimmed.length <= 2) {
            setUpdateError("Username must be greater than 2 characters.");
            setUpdateSuccess(null);
            return;
        }

        setIsUpdating(true);
        setUpdateError(null);
        setUpdateSuccess(null);

        try {
            await updateUsername(trimmed);
            setUpdateSuccess(`Username updated to "${trimmed}".`);
        } catch (error) {
            setUpdateError(
                error instanceof Error ? error.message : "Failed to update username."
            );
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteUserId = async () => {
        setIsDeleting(true);
        setDeleteError(null);

        try {
            await deleteUserId();
            setIsConfirmingDelete(false);
            onDeleted?.();
            onClose();
        } catch (error) {
            setDeleteError(
                error instanceof Error
                    ? error.message
                    : "Failed to delete user ID. Please try again."
            );
            setIsDeleting(false);
        }
    };

    return (
        <div
            className={`modal-backdrop ${variant === "neobrutal" ? "is-neobrutal" : ""}`}
            onClick={onClose}
            role="presentation"
        >
            <div
                className={`modal-card profile-modal-card ${variant === "neobrutal" ? "is-neobrutal" : ""}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-modal-title"
            >
                {/* Header */}
                <div className="modal-header">
                    <div>
                        <div className="profile-header-tag">Cheiron</div>
                        <h2 id="profile-modal-title" className="modal-heading">
                            Player Profile
                        </h2>
                        <p className="modal-sub">
                            Manage your display name and match identity
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="modal-close-btn"
                        aria-label="Close profile modal"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Identity & User ID Overview */}
                <section className="profile-session-card">
                    <div className="profile-identity-row">
                        <div className="profile-avatar">
                            {(userData?.nickname || nickname || "U")
                                .charAt(0)
                                .toUpperCase()}
                        </div>
                        <div className="profile-identity-info">
                            <span className="profile-identity-name">
                                {userData?.nickname || nickname || "Guest User"}
                            </span>
                            <span
                                className={`profile-status-badge ${
                                    isLoggedIn ? "status-online" : "status-offline"
                                }`}
                            >
                                <span className="status-indicator-dot" />
                                {isLoggedIn ? "Active Session" : "No Active Session"}
                            </span>
                        </div>
                    </div>


                    {userData?.initiatedAt && (
                        <div className="profile-meta-row">
                            <span className="meta-label">Session Started</span>
                            <span className="meta-value font-mono">
                                {new Date(userData.initiatedAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                })}
                            </span>
                        </div>
                    )}
                </section>

                {/* Change Name */}
                <section className="profile-section-block">
                    <h3 className="section-block-title">Display Name</h3>
                    <p className="section-block-desc">
                        The name shown to opponents during live matches.
                    </p>

                    <form onSubmit={handleUpdateUsername} className="update-username-form">
                        <div className="form-group">
                            <label htmlFor="update-nickname-input" className="form-label">
                                Name
                            </label>
                            <div className="input-with-button">
                                <input
                                    id="update-nickname-input"
                                    type="text"
                                    value={usernameInput}
                                    onChange={(e) => {
                                        setUsernameInput(e.target.value);
                                        setUpdateError(null);
                                        setUpdateSuccess(null);
                                    }}
                                    placeholder="Enter new username"
                                    className="form-input"
                                    maxLength={24}
                                    autoComplete="off"
                                />
                                <button
                                    type="submit"
                                    disabled={
                                        isUpdating ||
                                        !usernameInput.trim() ||
                                        usernameInput.trim() === (userData?.nickname || nickname)
                                    }
                                    className="btn-primary-action"
                                >
                                    {isUpdating ? "Saving..." : "Save Name"}
                                </button>
                            </div>
                        </div>

                        {updateError && (
                            <p className="form-error" role="alert">
                                {updateError}
                            </p>
                        )}
                        {updateSuccess && (
                            <p className="form-success" role="status">
                                {updateSuccess}
                            </p>
                        )}
                    </form>
                </section>

                {/* Reset Session */}
                <section className="profile-section-block danger-block">
                    <h3 className="section-block-title text-danger">
                        Reset Session
                    </h3>
                    <p className="section-block-desc">
                        Clear your active session and generate a fresh player token.
                    </p>

                    {deleteError && (
                        <p className="form-error" role="alert">
                            {deleteError}
                        </p>
                    )}

                    {!isConfirmingDelete ? (
                        <button
                            type="button"
                            onClick={() => setIsConfirmingDelete(true)}
                            className="btn-danger-outline"
                            disabled={!isLoggedIn}
                        >
                            <Trash2 size={14} />
                            <span>Reset Session</span>
                        </button>
                    ) : (
                        <div className="delete-confirm-box" role="alert">
                            <p className="confirm-prompt-text">
                                Are you sure? This will clear your stored identity and log you out.
                            </p>
                            <div className="confirm-btn-row">
                                <button
                                    type="button"
                                    onClick={() => setIsConfirmingDelete(false)}
                                    className="btn-secondary-action"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteUserId}
                                    className="btn-danger-confirm"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? "Resetting..." : "Yes, Reset Session"}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default ProfileModal;
