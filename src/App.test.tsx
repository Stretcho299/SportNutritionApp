import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import "@testing-library/jest-dom/vitest";
describe("App shell", () => {
  it("navigates between Séances and Nutrition", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Séances" }),
    ).toBeInTheDocument();
    const nutrition = screen.getByRole("button", { name: "Nutrition" });
    fireEvent.click(nutrition);
    expect(
      screen.getByRole("heading", { name: "Nutrition" }),
    ).toBeInTheDocument();
    expect(nutrition).toHaveAttribute("aria-current", "page");
  });
});
