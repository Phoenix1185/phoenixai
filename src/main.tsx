import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global unhandled rejection handler – prevents app crashes from network errors
window.addEventListener("unhandledrejection", (event) => {
  console.warn("Unhandled promise rejection:", event.reason);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
