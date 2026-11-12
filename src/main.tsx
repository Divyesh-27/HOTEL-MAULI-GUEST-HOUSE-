import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installNativeDialogFocusFix } from "./lib/nativeDialogFocusFix";

installNativeDialogFocusFix();

createRoot(document.getElementById("root")!).render(
  <App />
);
