import { Icon } from "./Icon";

export function BottomNavigation({ onWorkouts }: { onWorkouts: () => void }) {
  return (
    <nav className="bottom-navigation" aria-label="Navigation principale">
      <button className="active" aria-current="page" onClick={onWorkouts}>
        <Icon name="home" size={19} /> <span>Séances</span>
      </button>
      <button type="button" aria-disabled="true" title="Bientôt disponible">
        <Icon name="nutrition" size={19} /> <span>Nutrition</span>
      </button>
    </nav>
  );
}
