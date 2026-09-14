import { useState } from "react";
import "./App.css";
const sections = [
  {
    id: "workouts",
    label: "Séances",
    description: "Vos séances de musculation apparaîtront ici.",
  },
  {
    id: "nutrition",
    label: "Nutrition",
    description: "Votre suivi nutritionnel apparaîtra ici.",
  },
] as const;
type SectionId = (typeof sections)[number]["id"];
function App() {
  const [active, setActive] = useState<SectionId>("workouts");
  const section = sections.find((item) => item.id === active)!;
  return (
    <main className="app-shell">
      <header>
        <p>Sport Nutrition</p>
        <h1>{section.label}</h1>
      </header>
      <section className="empty" aria-live="polite">
        <h2>À venir</h2>
        <span>{section.description}</span>
      </section>
      <nav aria-label="Sections principales">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? "active" : ""}
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
export default App;
