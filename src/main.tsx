import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./ecosystem.css";
import "./safety.css";
import "./spaces.css";
import "./chat/replies.css";
import "./room/conversation.css";
import "./photo-banners.css";
import "./encounter-banner.css";
import "./mobile-inputs.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
