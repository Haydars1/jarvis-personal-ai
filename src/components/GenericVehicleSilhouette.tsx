import type { FaultSceneRegion } from "../domain/fault-scenes";
import type { FaultTone } from "../domain/faults.types";
import "./GenericVehicleSilhouette.css";

export interface GenericVehicleSilhouetteProps {
  region: FaultSceneRegion;
  tone: FaultTone;
}

const REGIONS: FaultSceneRegion[] = [
  "front-engine",
  "center-underbody",
  "rear-underbody",
  "wheels",
  "engine-lower",
  "cooling-front",
];

function RegionMarker({ region, active }: { region: FaultSceneRegion; active: boolean }) {
  const className = `genericVehicleRegion genericVehicleRegion-${region}${active ? " isActive" : ""}`;
  const dataProps = active ? { "data-active-region": "true" } : {};

  if (region === "front-engine") return <ellipse className={className} data-region={region} {...dataProps} cx="690" cy="194" rx="105" ry="70" />;
  if (region === "center-underbody") return <rect className={className} data-region={region} {...dataProps} x="350" y="275" width="270" height="44" rx="22" />;
  if (region === "rear-underbody") return <rect className={className} data-region={region} {...dataProps} x="180" y="250" width="230" height="60" rx="30" />;
  if (region === "engine-lower") return <ellipse className={className} data-region={region} {...dataProps} cx="650" cy="258" rx="110" ry="54" />;
  if (region === "cooling-front") return <ellipse className={className} data-region={region} {...dataProps} cx="760" cy="190" rx="70" ry="95" />;

  return (
    <g className={className} data-region={region} {...dataProps}>
      <circle cx="248" cy="292" r="58" />
      <circle cx="692" cy="292" r="58" />
    </g>
  );
}

export function GenericVehicleSilhouette({ region, tone }: GenericVehicleSilhouetteProps) {
  return (
    <svg
      className={`genericVehicle genericVehicleTone-${tone}`}
      data-generic-vehicle="true"
      aria-hidden="true"
      viewBox="0 0 920 390"
      role="presentation"
    >
      <defs>
        <linearGradient id="genericVehicleGlass" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.04" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.14" />
        </linearGradient>
      </defs>

      <path className="genericVehicleGround" d="M110 322 H820" />
      <path
        className="genericVehicleBody"
        d="M118 272 C135 236 173 218 229 209 L303 142 C328 119 361 108 399 105 H555 C601 108 635 121 665 151 L716 201 C767 209 805 225 824 255 L833 278 C836 291 828 299 813 300 H763 C758 246 729 219 690 219 C649 219 618 248 615 301 H324 C319 250 288 222 248 222 C208 222 178 249 173 300 H132 C111 300 104 287 118 272 Z"
      />
      <path className="genericVehicleGlass" d="M331 151 C354 130 380 121 414 119 H548 C584 121 610 133 636 159 L675 199 H292 Z" />
      <path className="genericVehicleLine" d="M292 199 H675" />
      <path className="genericVehicleLine" d="M451 120 L443 199" />
      <path className="genericVehicleLine" d="M566 122 L589 199" />
      <path className="genericVehicleLine" d="M351 208 L330 270" />
      <path className="genericVehicleLine" d="M590 207 L617 270" />
      <path className="genericVehicleLine genericVehicleSill" d="M326 286 H613" />
      <path className="genericVehicleLamp" d="M757 220 L806 239 L793 252 L752 245 Z" />
      <path className="genericVehicleLamp genericVehicleLampRear" d="M148 235 L192 226 L195 246 L151 255 Z" />

      <circle className="genericVehicleWheel" cx="248" cy="292" r="49" />
      <circle className="genericVehicleWheelInner" cx="248" cy="292" r="30" />
      <circle className="genericVehicleHub" cx="248" cy="292" r="8" />
      <circle className="genericVehicleWheel" cx="692" cy="292" r="49" />
      <circle className="genericVehicleWheelInner" cx="692" cy="292" r="30" />
      <circle className="genericVehicleHub" cx="692" cy="292" r="8" />

      <g className="genericVehicleRegions">
        {REGIONS.map((candidate) => (
          <RegionMarker key={candidate} region={candidate} active={candidate === region} />
        ))}
      </g>
    </svg>
  );
}
