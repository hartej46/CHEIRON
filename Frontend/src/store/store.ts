import { configureStore } from "@reduxjs/toolkit";
import authSlice from "./player.ts";

const store = configureStore({
    reducer: {
        auth: authSlice,
    },
});

export default store;
