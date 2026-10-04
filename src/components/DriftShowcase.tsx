const cars = [1, 2, 3, 4] as const;

export function DriftShowcase() {
  return (
    <div className="storyGraphic driftShowcase" aria-hidden="true" data-drift-track="true">
      <span className="storyRing storyRingOuter" />
      <span className="storyRing storyRingInner" />
      <span className="storyBeam" />
      <span className="storyDot" />
      {cars.map((car) => (
        <span className={`driftCar driftCar${car}`} data-drift-car={car} key={car}>
          <svg viewBox="0 0 64 30" focusable="false">
            <path className="driftCarBody" d="M5 20 L11 14 L21 12 L28 7 L45 7 L52 12 L59 15 L61 20 L56 23 L10 23 Z" />
            <path className="driftCarGlass" d="M24 12 L30 8.5 L43 8.5 L48 12 Z" />
            <circle cx="18" cy="22" r="5" />
            <circle cx="49" cy="22" r="5" />
          </svg>
        </span>
      ))}
    </div>
  );
}
