import "./DriftShowcase.css";

const outerTrack = "M44 258 C36 143 117 64 236 61 C329 58 365 103 431 96 C514 87 601 132 604 218 C607 285 562 307 524 332 C478 363 426 391 333 389 C234 387 193 344 143 340 C83 335 49 307 44 258 Z";
const innerTrack = "M143 249 C139 187 188 132 267 132 C338 132 369 166 424 158 C474 151 516 175 518 219 C520 252 490 267 462 285 C426 309 384 327 324 325 C258 323 230 292 193 290 C162 288 145 275 143 249 Z";
const guideTrack = "M92 253 C87 165 152 98 248 96 C330 94 366 133 429 125 C494 117 558 151 561 218 C564 267 526 287 492 309 C448 338 399 359 329 357 C250 354 216 319 170 317 C125 314 96 291 92 253 Z";
const rearLane = "M103 173 C192 107 330 93 451 123 C500 135 536 154 559 181";
const frontLane = "M551 286 C472 344 346 367 223 344 C157 332 111 309 84 279";

type BodyType = "coupe" | "sedan" | "wagon" | "hatch";
type DriftCarSpec = {
  id: number;
  layer: "rear" | "front";
  begin: string;
  scale: number;
  drift: number;
  facing: "right" | "left";
  body: BodyType;
};

const cars: readonly DriftCarSpec[] = [
  { id: 1, layer: "rear", begin: "0s", scale: 0.58, drift: -7, facing: "right", body: "coupe" },
  { id: 2, layer: "rear", begin: "-4s", scale: 0.64, drift: -9, facing: "right", body: "sedan" },
  { id: 3, layer: "rear", begin: "-8s", scale: 0.61, drift: -6, facing: "right", body: "hatch" },
  { id: 4, layer: "front", begin: "-1.4s", scale: 0.94, drift: 8, facing: "left", body: "wagon" },
  { id: 5, layer: "front", begin: "-5.4s", scale: 1.04, drift: 6, facing: "left", body: "coupe" },
  { id: 6, layer: "front", begin: "-9.4s", scale: 0.98, drift: 9, facing: "left", body: "sedan" },
];

const bodyPath: Record<BodyType, string> = {
  coupe: "M-70 9 C-60 -4 -44 -12 -22 -14 L-5 -31 C0 -36 9 -40 20 -40 H35 C48 -39 59 -31 70 -18 L82 -13 C93 -9 100 -2 104 9 L100 18 L82 21 H-59 L-74 16 Z",
  sedan: "M-70 9 C-59 -3 -44 -11 -25 -13 L-8 -29 C-2 -35 7 -39 19 -39 H45 C56 -38 66 -31 75 -20 L87 -14 C96 -10 103 -3 106 9 L101 18 L84 21 H-59 L-74 16 Z",
  wagon: "M-72 9 C-62 -4 -46 -12 -24 -14 L-7 -31 C-1 -36 7 -39 18 -39 H57 C67 -38 77 -32 86 -22 L96 -15 C103 -9 108 -1 110 10 L103 18 L86 21 H-61 L-76 16 Z",
  hatch: "M-67 9 C-58 -2 -44 -10 -25 -13 L-9 -28 C-3 -33 5 -36 15 -36 H40 C52 -35 62 -28 70 -18 L82 -13 C91 -9 98 -2 101 9 L96 18 L80 21 H-57 L-71 16 Z",
};

const glassPath: Record<BodyType, string> = {
  coupe: "M-5 -30 C1 -35 9 -37 20 -37 H34 C45 -36 53 -30 61 -20 H-14 Z",
  sedan: "M-7 -28 C0 -34 8 -36 19 -36 H43 C52 -35 59 -30 67 -20 H-16 Z",
  wagon: "M-7 -30 C0 -35 8 -36 19 -36 H54 C63 -35 71 -30 80 -21 H-16 Z",
  hatch: "M-8 -27 C-1 -32 6 -34 16 -34 H38 C48 -33 56 -28 63 -19 H-16 Z",
};

function SideProfileCar({ id, layer, begin, scale, drift, facing, body }: DriftCarSpec) {
  const motionPath = layer === "rear" ? rearLane : frontLane;
  const direction = facing === "left" ? -1 : 1;

  return (
    <g
      className={`driftVehicle driftVehicle${id} driftVehicle-${layer}`}
      data-drift-car={id}
      data-drift-layer={layer}
      data-drift-body={body}
    >
      <animateMotion dur="12s" begin={begin} repeatCount="indefinite" rotate="0" path={motionPath} />
      <animate attributeName="opacity" dur="12s" begin={begin} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;.07;.93;1" />
      <g transform={`rotate(${drift}) scale(${scale})`}>
        <g transform={`scale(${direction} 1)`}>
          <g className="driftSmokeCloud">
            <ellipse cx="-78" cy="9" rx="32" ry="11" />
            <ellipse cx="-101" cy="16" rx="23" ry="9" />
            <ellipse cx="-121" cy="22" rx="15" ry="7" />
          </g>

          <path className="driftCarShadow" d="M-66 20 C-26 27 62 27 100 20" />
          <path className="driftCarBody" d={bodyPath[body]} />
          <path className="driftCarLower" d="M-64 9 C-42 3 -18 1 5 1 H74 C86 1 96 5 103 10 L99 18 H-58 L-72 15 Z" />
          <path className="driftCarGlass" d={glassPath[body]} />
          <path className="driftCarPillar" d="M20 -37 L20 -18" />
          <path className="driftCarBeltline" d="M-47 -7 C-15 -12 38 -12 82 -8" />
          <path className="driftCarDoor" d="M5 -16 L3 5 M49 -15 L50 5" />
          <path className="driftCarHighlight" d="M-52 1 C-13 -7 39 -7 87 0" />
          <path className="driftCarLight driftCarLightFront" d="M83 -8 L99 -3 L101 3 L88 2 Z" />
          <path className="driftCarLight driftCarLightRear" d="M-65 -4 L-52 -8 L-51 2 L-68 5 Z" />
          <path className="driftCarSpoiler" d="M-53 -14 H-29 M-49 -18 V-12 M-34 -18 V-12" />

          <g className="driftWheelSet">
            <circle className="driftWheel" cx="-39" cy="18" r="14" />
            <circle className="driftRim" cx="-39" cy="18" r="7.5" />
            <circle className="driftHub" cx="-39" cy="18" r="2.2" />
            <circle className="driftWheel" cx="68" cy="18" r="14" />
            <circle className="driftRim" cx="68" cy="18" r="7.5" />
            <circle className="driftHub" cx="68" cy="18" r="2.2" />
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
      data-drift-layout="circuit"
    >
      <svg className="driftScene" viewBox="0 0 640 430" focusable="false">
        <defs>
          <linearGradient id="drift-road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b201c" />
            <stop offset=".5" stopColor="#111511" />
            <stop offset="1" stopColor="#090b0a" />
          </linearGradient>
          <radialGradient id="drift-center" cx="50%" cy="45%" r="62%">
            <stop offset="0" stopColor="#1c3a31" stopOpacity=".22" />
            <stop offset=".75" stopColor="#0b100d" stopOpacity=".06" />
            <stop offset="1" stopColor="#070907" stopOpacity="0" />
          </radialGradient>
          <filter id="drift-soft-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <ellipse className="driftGroundGlow" cx="320" cy="237" rx="290" ry="180" />
        <path className="driftTrackShadow" d={`${outerTrack} ${innerTrack}`} fillRule="evenodd" />
        <path className="driftTrackRoad" data-drift-surface="true" d={`${outerTrack} ${innerTrack}`} fillRule="evenodd" />
        <path className="driftTrackOuter" d={outerTrack} />
        <path className="driftTrackInner" d={innerTrack} />
        <path className="driftTrackGuide" d={guideTrack} />
        <path className="driftSkid driftSkidA" d="M76 279 C134 346 242 375 362 352" />
        <path className="driftSkid driftSkidB" d="M405 104 C507 109 567 157 570 218" />
        <path className="driftSkid driftSkidC" d="M159 320 C258 371 430 357 518 294" />
        <path className="driftCurb driftCurbA" d="M69 223 C74 185 94 152 119 131" />
        <path className="driftCurb driftCurbB" d="M511 337 C544 315 566 292 578 263" />
        <g className="driftStartGrid">
          <path d="M292 349 L324 357 M298 339 L330 347 M304 329 L336 337" />
        </g>

        <g className="driftCenterMark">
          <text x="320" y="218">6006</text>
          <text x="320" y="241">PERFORMANCE</text>
        </g>

        {cars.filter((car) => car.layer === "rear").map((car) => <SideProfileCar key={car.id} {...car} />)}
        {cars.filter((car) => car.layer === "front").map((car) => <SideProfileCar key={car.id} {...car} />)}
      </svg>
    </div>
  );
}
