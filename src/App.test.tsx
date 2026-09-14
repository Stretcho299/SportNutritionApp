import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import { __storageKey } from "./storage/database";
beforeEach(() => localStorage.clear());
it("creates a workout and persists it", async () => {
  render(<App />);
  fireEvent.click(screen.getByText("Créer une séance"));
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Push" } });
  fireEvent.click(screen.getByText("Enregistrer"));
  expect(screen.getByText("Push")).toBeInTheDocument();
  expect(localStorage.getItem(__storageKey)).toContain("Push");
});
it("adds and orders exercises and sets", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Créer une séance"));
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "A" } });
  fireEvent.click(screen.getByText("Enregistrer"));
  fireEvent.click(screen.getByText("A"));
  fireEvent.click(screen.getByText("Ajouter un exercice"));
  fireEvent.change(screen.getByLabelText("Nom"), {
    target: { value: "Squat" },
  });
  fireEvent.click(screen.getByText("Enregistrer"));
  fireEvent.click(screen.getByText("Squat"));
  fireEvent.click(screen.getByText("Ajouter une série"));
  fireEvent.change(screen.getByLabelText("Charge"), {
    target: { value: "80" },
  });
  fireEvent.change(screen.getByLabelText("Répétitions"), {
    target: { value: "8" },
  });
  fireEvent.click(screen.getByText("Enregistrer"));
  expect(screen.getByText(/80 kg/)).toBeInTheDocument();
});
