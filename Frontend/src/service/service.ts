import { AxiosError } from "axios";
import { apiClient } from "./apiClient.ts";

export interface GuestProfile {
    id: string;
    nickname: string;
    initiatedAt: string;
    expiresAt: string;
}

export interface SessionResponse {
    success: boolean;
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
export const initPlayer = async (userData?: string | { nickname?: string }): Promise<SessionResponse> => {
    const nickname = typeof userData === "string" ? userData : userData?.nickname;
    const payload = nickname ? { nickname: nickname.trim() } : {};

    try {
        const response = await apiClient.post<SessionResponse>("/session/init", payload);
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
