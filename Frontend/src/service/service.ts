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
}

interface ApiErrorResponse {
    message?: string;
}

/**
 *
 * @param userData
 * @returns { SessionResponse } on successfull conncection
 */

export const initPlayer = async (userData: string) => {
    try {
        const response = await apiClient.post<SessionResponse>("/session/init", userData || {});
        return response.data;
    } catch (error: unknown) {
        const fallbackMessage = "Something went wrong";
        if (error instanceof AxiosError) {
            return (
                (error.response?.data as ApiErrorResponse)?.message ||
                error.message ||
                fallbackMessage
            );
        }
        return fallbackMessage;
    }
};

/**
 *
 * @returns { SessionResponse } on successfull conncection
 */

export const getSessionDetails = async () => {
    try {
        const response = await apiClient.get<SessionResponse>("/session/me");
        return response.data;
    } catch (error: unknown) {
        const fallbackMessage = "Something went wrong";
        if (error instanceof AxiosError) {
            return (
                (error.response?.data as ApiErrorResponse)?.message ||
                error.message ||
                fallbackMessage
            );
        }
        return fallbackMessage;
    }
};

/**
 * Clears the HttpOnly cookie and calls deletePlayer from your RAM userMap.
 */

export const clearSession = async () => {
    try {
        const response = await apiClient.post("/session/clear");
        return response.data;
    } catch (error: unknown) {
        const fallbackMessage = "Something went wrong";
        if (error instanceof AxiosError) {
            return (
                (error.response?.data as ApiErrorResponse)?.message ||
                error.message ||
                fallbackMessage
            );
        }
        return fallbackMessage;
    }
};
