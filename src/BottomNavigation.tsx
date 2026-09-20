import { Icon } from "./Icon";

export function BottomNavigation({ onWorkouts }: { onWorkouts: () => void }) {
  return (
    <nav className="bottom-navigation" aria-label="Navigation principale">
      <button
        className="active"
        aria-label="Musculation"
        aria-current="page"
        onClick={onWorkouts}
      >
        <Icon name="dumbbell" size={25} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        aria-label="Nutrition"
        aria-disabled="true"
        title="Bientôt disponible"
      >
        <Icon name="nutrition" size={25} strokeWidth={1.9} />
      </button>
    </nav>
  );
}
