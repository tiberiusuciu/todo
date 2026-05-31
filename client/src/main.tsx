import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { VersionStamp } from "./components/VersionStamp";
import { AuthProvider } from "./context/AuthContext";
import { AppVersionGuard } from "./hooks/useAppVersionCheck";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppVersionGuard />
    <VersionStamp />
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
