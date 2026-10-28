import axios from "axios";
import { config } from "../config/Config.ts";

export const apiClient = axios.create({
    baseURL: config.apiURL || undefined,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

apiClient.interceptors.request.use((reqConfig) => {
    const token =
        sessionStorage.getItem("jwtToken") || localStorage.getItem("jwtToken");
    if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
});
