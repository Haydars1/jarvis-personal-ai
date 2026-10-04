import "./DriftShowcase.css";

const outerTrack = "M55 242 C52 125 166 60 316 62 C480 65 594 128 588 232 C582 339 459 390 310 387 C158 384 60 337 55 242 Z";
const innerTrack = "M151 237 C151 165 225 121 321 122 C423 123 493 164 492 232 C491 299 421 329 317 328 C217 327 151 300 151 237 Z";
const guideTrack = "M102 240 C100 145 191 91 318 92 C450 94 543 145 539 232 C535 318 445 355 313 353 C184 351 105 316 102 240 Z";
const rearLane = "M105 166 C214 90 412 88 542 166";
const frontLane = "M548 286 C434 359 225 358 93 286";

type DriftCarSpec = {
  id: number;
  layer: "rear" | "front";
  begin: string;
  scale: number;
  drift: number;
  facing: "right" | "left";
};

const cars: readonly DriftCarSpec[] = [
  { id: 1, layer: "rear", begin: "0s", scale: 0.62, drift: -6, facing: "right" },
  { id: 2, layer: "rear", begin: "-4s", scale: 0.69, drift: -8, facing: "right" },
  { id: 3, layer: "rear", begin: "-8s", scale: 0.65, drift: -5, facing: "right" },
  { id: 4, layer: "front", begin: "-1.4s", scale: 0.96, drift: 7, facing: "left" },
  { id: 5, layer: "front", begin: "-5.4s", scale: 1.08, drift: 5, facing: "left" },
  { id: 6, layer: "front", begin: "-9.4s", scale: 1, drift: 8, facing: "left" },
];

function SideProfileCar({ id, layer, begin, scale, drift, facing }: DriftCarSpec) {
  const motionPath = layer === "rear" ? rearLane : frontLane;
  const direction = facing === "left" ? -1 : 1;

  return (
    <g className={`driftVehicle driftVehicle${id} driftVehicle-${layer}`} data-drift-car={id} data-drift-layer={layer}>
      <animateMotion dur="12s" begin={begin} repeatCount="indefinite" rotate="0" path={motionPath} />
      <animate attributeName="opacity" dur="12s" begin={begin} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;.08;.92;1" />
      <g transform={`rotate(${drift}) scale(${scale})`}>
        <g transform={`scale(${direction} 1)`}>
          <g className="driftSmokeCloud">
            <ellipse cx="-69" cy="11" rx="31" ry="11" />
            <ellipse cx="-91" cy="18" rx="21" ry="9" />
            <ellipse cx="-108" cy="23" rx="14" ry="7" />
            <ellipse cx="-119" cy="27" rx="9" ry="5" />
          </g>

          <path className="driftCarBody" d="M-62 4 C-52 -7 -39 -11 -23 -12 L-9 -28 C-5 -33 2 -36 10 -36 H31 C41 -35 49 -28 57 -17 L69 -11 C77 -8 83 -2 86 8 L82 17 L69 20 H-54 L-68 15 Z" />
          <path className="driftCarLower" d="M-59 9 C-43 3 -24 1 -7 1 H58 C68 1 77 5 83 10 L81 17 H-53 L-66 14 Z" />
          <path className="driftCarGlass" d="M-3 -27 C1 -31 6 -33 12 -33 H30 C38 -32 44 -27 50 -18 H-11 Z" />
          <path className="driftCarPillar" d="M18 -33 L18 -18" />
          <path className="driftCarBeltline" d="M-43 -7 C-15 -12 33 -12 66 -8" />
          <path className="driftCarDoor" d="M3 -16 L1 5 M42 -15 L43 5" />
          <path className="driftCarLight driftCarLightFront" d="M69 -8 L82 -3 L84 3 L72 2 Z" />
          <path className="driftCarLight driftCarLightRear" d="M-59 -4 L-49 -8 L-48 1 L-62 4 Z" />
          <path className="driftCarSpoiler" d="M-49 -14 H-27 M-45 -18 V-12 M-31 -18 V-12" />

          <g className="driftWheelSet">
            <circle className="driftWheel" cx="-37" cy="17" r="13" />
            <circle className="driftRim" cx="-37" cy="17" r="7" />
            <circle className="driftHub" cx="-37" cy="17" r="2.2" />
            <circle className="driftWheel" cx="55" cy="17" r="13" />
            <circle className="driftRim" cx="55" cy="17" r="7" />
            <circle className="driftHub" cx="55" cy="17" r="2.2" />
          </g>
        </g>
      </g>
    </g>
  );
}

export function DriftShowcase() {
  return (
    <div
      className="storyGraphic driftShowcase"
      aria-hidden="true"
      data-drift-track="true"
      data-drift-perspective="side"
    >
      <svg className="driftScene" viewBox="0 0 640 430" focusable="false">
        <defs>
          <linearGradient id="drift-road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#191d1a" />
            <stop offset=".55" stopColor="#0e120f" />
            <stop offset="1" stopColor="#090b0a" />
          </linearGradient>
          <radialGradient id="drift-center" cx="50%" cy="45%" r="58%">
            <stop offset="0" stopColor="#183a30" stopOpacity=".28" />
            <stop offset=".7" stopColor="#0b100d" stopOpacity=".08" />
            <stop offset="1" stopColor="#070907" stopOpacity="0" />
          </radialGradient>
          <filter id="drift-soft-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="drift-smoke-blur" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        <ellipse className="driftGroundGlow" cx="320" cy="236" rx="282" ry="178" />
        <path className="driftTrackShadow" d={`${outerTrack} ${innerTrack}`} fillRule="evenodd" />
        <path className="driftTrackRoad" data-drift-surface="true" d={`${outerTrack} ${innerTrack}`} fillRule="evenodd" />
        <path className="driftTrackOuter" d={outerTrack} />
        <path className="driftTrackInner" d={innerTrack} />
        <path className="driftTrackGuide" d={guideTrack} />
        <path className="driftSkid driftSkidA" d="M92 283 C130 344 225 368 346 353" />
        <path className="driftSkid driftSkidB" d="M376 94 C483 102 550 153 555 213" />
        <path className="driftSkid driftSkidC" d="M145 315 C236 367 414 362 505 302" />

        <g className="driftCenterMark">
          <text x="320" y="221">6006</text>
          <text x="320" y="244">PERFORMANCE</text>
        </g>

        {cars.filter((car) => car.layer === "rear").map((car) => <SideProfileCar key={car.id} {...car} />)}
        {cars.filter((car) => car.layer === "front").map((car) => <SideProfileCar key={car.id} {...car} />)}
      </svg>
    </div>
  );
}
