import axios from "axios";
import { config } from "../config/Config.ts";

export const apiClient = axios.create({
    baseURL: config.apiURL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});
