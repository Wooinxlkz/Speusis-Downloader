import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Basket from "./basket/Basket";

createRoot(document.getElementById("root")).render(
  <StrictMode><Basket /></StrictMode>
);
