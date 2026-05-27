import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { applyThemeMode } from "./theme";
import { useApp } from "./store";
import "./styles.css";

// Sett initial tema-klasse før første paint
applyThemeMode(useApp.getState().themeMode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
