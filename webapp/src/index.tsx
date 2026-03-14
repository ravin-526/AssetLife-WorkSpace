import React from "react";
import ReactDOM from "react-dom/client";
import "primeflex/primeflex.css";
import "primeicons/primeicons.css";

import App from "./App.tsx";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element with id 'root' was not found");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
