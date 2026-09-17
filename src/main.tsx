import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Skry bootsplash až po namontovaní Reactu
requestAnimationFrame(() => {
  const boot = document.getElementById("cs-boot");
  if (boot) boot.remove();
});
