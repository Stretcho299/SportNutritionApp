import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ActiveRestTimer } from "./ActiveRestTimer";

it("opens and closes the rest detail without replacing the persistent timer", () => {
  const onFinish = vi.fn();
  const { rerender } = render(
    <ActiveRestTimer
      remaining={25}
      total={30}
      exerciseName="Développé couché"
      setNumber={2}
      onFinish={onFinish}
    />,
  );

  const timer = screen.getByRole("timer");
  expect(timer).toHaveTextContent("0:25");
  expect(timer).toHaveAttribute("data-reference-seconds", "30");
  expect(timer.querySelector(".mini-timer-track > span")).toHaveStyle({
    width: `${(1 - 25 / 30) * 100}%`,
  });

  fireEvent.click(
    within(timer).getByRole("button", { name: "Ouvrir le chrono de repos" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Détail du repos" });
  expect(dialog).toHaveTextContent("Développé couché · Série 2");
  expect(dialog).toHaveTextContent("/ 0:30");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Fermer le chrono" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("timer")).toBeInTheDocument();

  rerender(
    <ActiveRestTimer
      remaining={24}
      total={30}
      exerciseName="Développé couché"
      setNumber={2}
      onFinish={onFinish}
    />,
  );
  expect(screen.getByRole("timer")).toHaveAttribute(
    "data-reference-seconds",
    "30",
  );
  fireEvent.click(
    within(screen.getByRole("timer")).getByRole("button", {
      name: "Fin de repos",
    }),
  );
  expect(onFinish).toHaveBeenCalledOnce();
});
