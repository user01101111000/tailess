import { Button, ButtonRow } from "@acme/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";

function App() {
  return (
    <main style={{ padding: "1rem" }}>
      <ButtonRow>
        <Button tone="brand">Save</Button>
        <Button tone="ghost">Cancel</Button>
      </ButtonRow>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
