import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

// StrictMode, as the embed renders the examples
createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
