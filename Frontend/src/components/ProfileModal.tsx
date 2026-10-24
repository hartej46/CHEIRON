import React, { useState, useEffect } from "react";
import { useNickname } from "../context/NicknameContext";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDeleted?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
    isOpen,
    onClose,
    onDeleted,
}) => {
    if (!isOpen) return null;

    return (
        <ProfileModalDialog
            onClose={onClose}
            onDeleted={onDeleted}
        />
    );
};

const ProfileModalDialog: React.FC<Omit<ProfileModalProps, "isOpen">> = ({
    onClose,
    onDeleted,
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
    const [hasCopiedId, setHasCopiedId] = useState(false);

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

    const handleCopyId = async () => {
        if (!userData?.id) return;
        try {
            await navigator.clipboard.writeText(userData.id);
            setHasCopiedId(true);
            setTimeout(() => setHasCopiedId(false), 2000);
        } catch {
            // Clipboard write fallback
        }
    };

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
            className="modal-backdrop"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="modal-card profile-modal-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-modal-title"
            >
                {/* Header */}
                <div className="modal-header">
                    <div>
                        <div className="profile-header-tag">CHEIRON PROFILE</div>
                        <h2 id="profile-modal-title" className="modal-heading">
                            User Profile
                        </h2>
                        <p className="modal-sub">
                            Manage your identity and session preferences
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="modal-close-btn"
                        aria-label="Close profile modal"
                    >
                        ✕
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

                    {/* User ID Section */}
                    <div className="profile-meta-field">
                        <div className="meta-field-label-row">
                            <span className="meta-label">User ID</span>
                            {userData?.id && (
                                <button
                                    type="button"
                                    onClick={handleCopyId}
                                    className="btn-copy-id"
                                    title="Copy User ID"
                                >
                                    {hasCopiedId ? "✓ Copied" : "Copy ID"}
                                </button>
                            )}
                        </div>
                        <div className="user-id-display font-mono">
                            {userData?.id || "No User ID assigned yet"}
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

                {/* Option 1: Update Username */}
                <section className="profile-section-block">
                    <h3 className="section-block-title">Option 1: Update Username</h3>
                    <p className="section-block-desc">
                        Change the nickname displayed to partners in video calls.
                    </p>

                    <form onSubmit={handleUpdateUsername} className="update-username-form">
                        <div className="form-group">
                            <label htmlFor="update-nickname-input" className="form-label">
                                Nickname
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
                                    {isUpdating ? "Updating..." : "Update Username"}
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

                {/* Option 2: Delete User ID */}
                <section className="profile-section-block danger-block">
                    <h3 className="section-block-title text-danger">
                        Option 2: Delete User ID
                    </h3>
                    <p className="section-block-desc">
                        Permanently delete your current User ID and clear your stored JWT session.
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
                            disabled={!isLoggedIn && !userData?.id}
                        >
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                            >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete User ID
                        </button>
                    ) : (
                        <div className="delete-confirm-box" role="alert">
                            <p className="confirm-prompt-text">
                                Are you sure? This will delete User ID{" "}
                                <strong>{userData?.id || "session"}</strong> and log you out.
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
                                    {isDeleting ? "Deleting..." : "Yes, Delete User ID"}
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
