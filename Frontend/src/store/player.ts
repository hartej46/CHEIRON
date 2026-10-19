import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { getSessionDetails, clearSession } from "../service/service";
import { AxiosError } from "axios";

interface ApiErrorResponse {
    message?: string;
}

export interface PlayerProfile {
    id: string;
    nickname: string;
    initiatedAt: string;
    expiresAt: string;
}

export interface SessionApiResponse {
    success: boolean;
    profile: PlayerProfile;
}

interface PlayerState {
    isLoggedin: boolean;
    userData: PlayerProfile | null;
    isCheckingSession: boolean;
    error: string | null;
}

export const fetchUser = createAsyncThunk<PlayerProfile, void, { rejectValue: string }>(
    "user/me",
    async (_, { rejectWithValue }) => {
        try {
            const response = await getSessionDetails();
            if (response && response.profile) {
                return response.profile;
            }
            return rejectWithValue("Unable to connect to server. Please refresh your page.");
        } catch (error: unknown) {
            if (error instanceof AxiosError) {
                const message =
                    (error.response?.data as ApiErrorResponse)?.message ||
                    error.message ||
                    "Unable to connect to server. Please refresh your page.";
                return rejectWithValue(message);
            }
            return rejectWithValue(
                error instanceof Error
                    ? error.message
                    : "Unable to connect to server. Please refresh your page."
            );
        }
    }
);

export const logoutUser = createAsyncThunk<void, void>("user/logout", async () => {
    await clearSession();
});

const initialState: PlayerState = {
    isLoggedin: false,
    userData: null,
    isCheckingSession: true,
    error: null,
};

const playerSlice = createSlice({
    name: "player",
    initialState,
    reducers: {
        login: (state, action: PayloadAction<PlayerProfile>) => {
            state.isLoggedin = true;
            state.userData = action.payload;
            state.isCheckingSession = false;
            state.error = null;
        },
        updatePlayerNickname: (state, action: PayloadAction<string>) => {
            if (state.userData) {
                state.userData.nickname = action.payload;
            }
        },
        logout: (state) => {
            state.isLoggedin = false;
            state.userData = null;
            state.isCheckingSession = false;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUser.pending, (state) => {
                state.isCheckingSession = true;
                state.error = null;
            })
            .addCase(fetchUser.fulfilled, (state, action: PayloadAction<PlayerProfile>) => {
                state.isLoggedin = true;
                state.userData = action.payload;
                state.isCheckingSession = false;
                state.error = null;
            })
            .addCase(fetchUser.rejected, (state, action) => {
                state.isLoggedin = false;
                state.userData = null;
                state.isCheckingSession = false;
                state.error =
                    action.payload ||
                    action.error.message ||
                    "Unable to connect to server. Please refresh your page.";
            })
            .addCase(logoutUser.fulfilled, (state) => {
                state.isLoggedin = false;
                state.userData = null;
                state.isCheckingSession = false;
                state.error = null;
            });
    },
});

export const { login, updatePlayerNickname, logout } = playerSlice.actions;
export default playerSlice.reducer;
