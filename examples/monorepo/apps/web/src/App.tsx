import { Button, ButtonRow } from "@acme/ui";
import * as s from "./App.styles";

export function App() {
  return (
    <main className={s.page}>
      <h1 className={s.title}>The design system, compiled from its source</h1>
      <ButtonRow>
        <Button tone="brand">Save</Button>
        <Button tone="ghost">Cancel</Button>
      </ButtonRow>
    </main>
  );
}
