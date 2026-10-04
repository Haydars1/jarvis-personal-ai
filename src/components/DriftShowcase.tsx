import "./DriftShowcase.css";

const trackPath = "M 82 220 C 70 132 165 72 302 78 C 447 84 552 126 566 213 C 580 302 474 346 328 346 C 181 346 93 307 82 220 Z";

const cars = [
  { id: 1, begin: "0s", drift: -17, scale: 1.02 },
  { id: 2, begin: "-2.25s", drift: -14, scale: 0.92 },
  { id: 3, begin: "-4.5s", drift: -19, scale: 1.08 },
  { id: 4, begin: "-6.75s", drift: -15, scale: 0.96 },
  { id: 5, begin: "-9s", drift: -20, scale: 1.04 },
  { id: 6, begin: "-11.25s", drift: -16, scale: 0.9 },
] as const;

function DriftCar({ id, begin, drift, scale }: (typeof cars)[number]) {
  return (
    <g className={`driftVehicle driftVehicle${id}`} data-drift-car={id}>
      <animateMotion dur="13.5s" begin={begin} repeatCount="indefinite" rotate="auto" path={trackPath} />
      <g transform={`rotate(${drift}) scale(${scale})`}>
        <g className="driftSmokeCloud">
          <ellipse cx="-44" cy="12" rx="18" ry="8" />
          <ellipse cx="-55" cy="17" rx="12" ry="6" />
          <ellipse cx="-36" cy="19" rx="10" ry="5" />
        </g>
        <g className="driftWheels">
          <rect x="-31" y="-21" width="14" height="6" rx="2" />
          <rect x="18" y="-21" width="14" height="6" rx="2" />
          <rect x="-31" y="15" width="14" height="6" rx="2" />
          <rect x="18" y="15" width="14" height="6" rx="2" />
        </g>
        <path className="driftCarPaint" d="M-43 -9 C-36 -17 -24 -20 -9 -20 H18 C31 -20 40 -14 44 -7 L46 8 C39 16 28 20 13 20 H-16 C-30 19 -39 14 -45 7 Z" />
        <path className="driftCarHood" d="M18 -14 C30 -13 38 -9 42 -4 L42 7 C35 10 27 12 17 12 Z" />
        <path className="driftCarGlass" d="M-15 -15 H13 C20 -15 25 -11 28 -6 L25 7 H-18 L-24 -5 C-22 -10 -20 -13 -15 -15 Z" />
        <path className="driftCarWindowLine" d="M1 -15 V7 M-20 -4 H27" />
        <path className="driftCarLight driftCarLightFront" d="M38 -6 L45 -3 L44 3 L37 1 Z" />
        <path className="driftCarLight driftCarLightRear" d="M-43 -5 L-37 -7 L-36 5 L-44 4 Z" />
        <path className="driftCarSpoiler" d="M-35 -15 H-20 M-31 -18 V-13 M-23 -18 V-13" />
      </g>
    </g>
  );
}

export function DriftShowcase() {
  return (
    <div className="storyGraphic driftShowcase" aria-hidden="true" data-drift-track="true">
      <svg className="driftScene" viewBox="0 0 640 420" focusable="false">
        <defs>
          <filter id="drift-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path className="driftTrackShadow" d={trackPath} />
        <path className="driftAsphalt" data-drift-surface="true" d={trackPath} />
        <path className="driftTrackEdge driftTrackEdgeOuter" d={trackPath} />
        <path className="driftTrackGuide" d={trackPath} />
        <path className="driftSkid driftSkidA" d="M92 226 C78 156 170 92 301 96 C430 99 526 137 548 211" />
        <path className="driftSkid driftSkidB" d="M552 225 C548 291 461 326 330 328 C205 330 116 300 99 246" />
        <g className="driftCenterMark">
          <text x="320" y="202">6006</text>
          <text x="320" y="226">PERFORMANCE</text>
        </g>
        {cars.map((car) => <DriftCar key={car.id} {...car} />)}
      </svg>
    </div>
  );
}
