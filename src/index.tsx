// src/index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ClubProvider } from "./hooks/useClub.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ClubProvider>
            <App />
        </ClubProvider>
    </React.StrictMode>
);
