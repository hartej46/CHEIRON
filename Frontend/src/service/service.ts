import { AxiosError } from "axios";
import { apiClient } from "./apiClient.ts";
import { setStoredToken, removeStoredToken } from "../utils/storage.ts";

export interface GuestProfile {
    nickname: string;
    initiatedAt: string;
    expiresAt: string;
}

export interface SessionResponse {
    success: boolean;
    token?: string;
    profile: GuestProfile;
    message?: string;
}

interface ApiErrorResponse {
    message?: string;
}

/**
 * Initiates player session with the backend.
 * Throws an error directing the user to refresh their page if connection fails.
 */
export const initPlayer = async (
    userData?: string | { nickname?: string }
): Promise<SessionResponse> => {
    const nickname = typeof userData === "string" ? userData : userData?.nickname;
    const trimmed = nickname ? nickname.trim() : undefined;

    if (trimmed !== undefined && trimmed.length <= 2) {
        throw new Error("Username must be greater than 2 characters.");
    }

    const payload = trimmed ? { nickname: trimmed } : {};

    try {
        const response = await apiClient.post<SessionResponse>("/session/init", payload);
        if (response.data && response.data.profile) {
            if (response.data.token) {
                setStoredToken(response.data.token);
            }
            return response.data;
        }
        throw new Error("Unable to connect to server. Please refresh your page.");
    } catch (error: unknown) {
        // initPlayer network/API error — propagated to the caller
        let msg = "Unable to connect to server. Please refresh your page.";
        if (error instanceof AxiosError) {
            msg = (error.response?.data as ApiErrorResponse)?.message || msg;
        }
        throw new Error(msg, { cause: error });
    }
};

/**
 * Fetches the current session details from /session/me.
 * Throws an error directing the user to refresh their page if connection fails.
 */
export const getSessionDetails = async (): Promise<SessionResponse> => {
    try {
        const response = await apiClient.get<SessionResponse>("/session/me");
        if (response.data && response.data.profile) {
            return response.data;
        }
        throw new Error("Unable to connect to server. Please refresh your page.");
    } catch (error: unknown) {
        let msg = "Unable to connect to server. Please refresh your page.";
        if (error instanceof AxiosError) {
            msg = (error.response?.data as ApiErrorResponse)?.message || msg;
        }
        throw new Error(msg, { cause: error });
    }
};

/**
 * Clears the session on backend.
 */
export const clearSession = async (): Promise<{ success: boolean; message?: string }> => {
    try {
        removeStoredToken();
        const response = await apiClient.post("/session/clear");
        return response.data || { success: true };
    } catch (error: unknown) {
        let msg = "Unable to clear session.";
        if (error instanceof AxiosError) {
            msg = (error.response?.data as ApiErrorResponse)?.message || msg;
        }
        throw new Error(msg, { cause: error });
    }
};

/**
 * Checks if the backend server is reachable and healthy.
 * Pings root endpoint (which returns 200 on all backend deployments) with fallback to /health.
 */
export const checkBackendHealth = async (): Promise<boolean> => {
    try {
        const response = await apiClient.get("/", { timeout: 5000 });
        if (response.status === 200) return true;
    } catch {
        // Fall through to /health fallback
    }

    try {
        const response = await apiClient.get("/health", { timeout: 5000 });
        return response.status === 200;
    } catch {
        return false;
    }
};
