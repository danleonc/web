import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AccountProvider } from "./shared/accounts";
import "./styles.css";
import "./ecosystem.css";
import "./safety.css";
import "./spaces.css";
import "./chat/replies.css";
import "./room/conversation.css";
import "./photo-banners.css";
import "./encounter-banner.css";
import "./shared/access.css";
import "./mobile-inputs.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AccountProvider>
      <App />
    </AccountProvider>
  </React.StrictMode>,
);
