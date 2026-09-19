import { createRoot } from "react-dom/client";
import AppMobile from "./mobile/AppMobile.tsx";
import App from "./App.tsx";
import "./index.css";

const isDesktopMode = window.location.search.includes("mode=desktop");

createRoot(document.getElementById("root")!).render(
  isDesktopMode ? <App /> : <AppMobile />
);
