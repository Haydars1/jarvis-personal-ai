import type { FaultSceneRegion } from "../domain/fault-scenes";
import type { FaultTone } from "../domain/faults.types";
import { XRAY_BOOST_SRC } from "../assets/xrayBoost";
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

  if (region === "front-engine") {
    return (
      <g className={className} data-region={region} {...dataProps}>
        <ellipse cx="698" cy="206" rx="116" ry="76" />
        <path d="M612 223 C651 171 729 158 795 196" />
      </g>
    );
  }
  if (region === "center-underbody") {
    return (
      <g className={className} data-region={region} {...dataProps}>
        <rect x="396" y="288" width="235" height="52" rx="26" />
        <path d="M410 315 H620" />
      </g>
    );
  }
  if (region === "rear-underbody") {
    return (
      <g className={className} data-region={region} {...dataProps}>
        <rect x="176" y="277" width="252" height="68" rx="34" />
        <path d="M196 312 H416" />
      </g>
    );
  }
  if (region === "engine-lower") {
    return (
      <g className={className} data-region={region} {...dataProps}>
        <ellipse cx="665" cy="271" rx="105" ry="51" />
        <path d="M590 280 C632 300 701 302 746 275" />
      </g>
    );
  }
  if (region === "cooling-front") {
    return (
      <g className={className} data-region={region} {...dataProps}>
        <ellipse cx="825" cy="207" rx="60" ry="98" />
        <path d="M802 139 V274 M822 136 V277 M842 144 V270" />
      </g>
    );
  }

  return (
    <g className={className} data-region={region} {...dataProps}>
      <ellipse cx="266" cy="301" rx="74" ry="66" />
      <ellipse cx="742" cy="301" rx="74" ry="66" />
      <path d="M266 232 V178 M742 232 V163" />
    </g>
  );
}

function PhotorealBoostVehicle({ tone }: { tone: FaultTone }) {
  return (
    <div
      className={`genericVehicle genericVehiclePhotoreal genericVehicleTone-${tone}`}
      data-generic-vehicle="true"
      data-photoreal-xray="true"
      data-active-system-region="front-engine"
      aria-hidden="true"
      role="presentation"
    >
      <img className="genericVehiclePhotorealImage" src={XRAY_BOOST_SRC} alt="" draggable={false} />
      <div className="genericVehiclePhotoVignette" />
      <div className="genericVehiclePhotoGrid" />
      <div className="genericVehiclePhotoScan" data-scan-layer="true"><i /></div>
      <div
        className="genericVehiclePhotoActive"
        data-region="front-engine"
        data-active-region="true"
      >
        <span className="genericVehiclePhotoTurboPulse" />
        <span className="genericVehiclePhotoFlow genericVehiclePhotoFlowA" />
        <span className="genericVehiclePhotoFlow genericVehiclePhotoFlowB" />
        <span className="genericVehiclePhotoDot genericVehiclePhotoDotA" />
        <span className="genericVehiclePhotoDot genericVehiclePhotoDotB" />
        <span className="genericVehiclePhotoDot genericVehiclePhotoDotC" />
      </div>
    </div>
  );
}

export function GenericVehicleSilhouette({ region, tone }: GenericVehicleSilhouetteProps) {
  if (region === "front-engine") {
    return <PhotorealBoostVehicle tone={tone} />;
  }

  return (
    <svg
      className={`genericVehicle genericVehicleTone-${tone}`}
      data-generic-vehicle="true"
      data-active-system-region={region}
      aria-hidden="true"
      viewBox="0 0 960 430"
      role="presentation"
    >
      <defs>
        <linearGradient id="genericVehicleShell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.035" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.012" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.07" />
        </linearGradient>
        <linearGradient id="genericVehicleScan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.48" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.42" />
          <stop offset="0.52" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <filter id="genericVehicleSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="genericVehicleBodyClip">
          <path d="M116 274 C137 222 199 188 292 170 L382 104 C426 72 479 62 546 68 L665 84 C716 91 757 111 793 145 L839 189 C874 199 899 220 908 250 L913 275 C917 291 906 303 886 304 H817 C808 251 778 225 738 225 C694 225 661 255 654 306 H352 C345 254 312 226 268 226 C225 226 193 255 184 306 H132 C107 306 101 289 116 274 Z" />
        </clipPath>
      </defs>

      <path className="genericVehicleGround" d="M82 353 H914" />

      <g className="genericVehicleXray" data-xray-layer="true">
        <path className="genericVehicleChassis" d="M206 314 L360 314 L415 289 L662 289 L712 315 L824 315" />
        <path className="genericVehicleChassis" d="M236 286 L383 286 L430 267 L645 267 L695 286 L790 286" />
        <path className="genericVehicleChassisBrace" d="M383 286 L415 314 M430 267 L460 289 M645 267 L615 289 M695 286 L662 315" />

        <g className="genericVehicleSystem genericVehicleSystem-engine" data-system="engine" data-system-node="true">
          <path d="M614 178 L687 164 L744 183 L748 250 L670 267 L609 239 Z" />
          <path d="M628 190 L682 180 L728 194 L730 235 L673 248 L626 229 Z" />
          <path d="M642 188 L645 232 M661 183 L663 237 M681 179 L682 241 M701 184 L701 238" />
          <path d="M618 211 H738 M624 224 H735" />
        </g>

        <g className="genericVehicleSystem genericVehicleSystem-turbo" data-system="turbo" data-system-node="true">
          <circle cx="759" cy="215" r="29" />
          <circle className="genericVehicleTurbine" cx="759" cy="215" r="17" />
          <path d="M759 198 L766 209 L779 211 L769 219 L770 233 L759 226 L748 233 L749 219 L739 211 L752 209 Z" />
          <path className="genericVehicleFlowLine" d="M788 214 C813 210 826 197 835 176" />
          <path className="genericVehicleFlowLine" d="M733 215 C714 211 702 202 692 189" />
        </g>

        <g className="genericVehicleSystem genericVehicleSystem-cooling" data-system="cooling" data-system-node="true">
          <path d="M815 156 L861 166 L855 268 L808 260 Z" />
          <path d="M818 171 L858 180 M816 190 L857 198 M814 209 L856 216 M812 228 L855 234 M810 247 L854 252" />
          <path className="genericVehicleFlowLine" d="M807 196 C786 178 762 176 735 184" />
          <path className="genericVehicleFlowLine" d="M806 235 C785 250 752 256 724 251" />
        </g>

        <g className="genericVehicleSystem genericVehicleSystem-exhaust" data-system="exhaust" data-system-node="true">
          <path className="genericVehicleFlowLine genericVehicleExhaustPipe" d="M618 259 C574 277 542 289 502 298 C442 312 375 316 311 319 C262 321 219 318 178 310" />
          <rect className="genericVehicleDpf" x="435" y="284" width="92" height="42" rx="15" />
          <path className="genericVehicleDpf" d="M448 293 L514 317 M448 317 L514 293" />
          <rect className="genericVehicleRearTreatment" x="249" y="296" width="94" height="37" rx="17" />
          <circle cx="383" cy="307" r="9" />
          <circle cx="361" cy="311" r="6" />
        </g>

        <g className="genericVehicleSystem genericVehicleSystem-suspension" data-system="suspension" data-system-node="true">
          <path d="M242 238 L261 194 L280 238 M718 236 L741 180 L758 238" />
          <path d="M249 204 L273 230 M727 192 L754 226" />
          <circle cx="268" cy="301" r="55" />
          <circle cx="268" cy="301" r="31" />
          <circle cx="738" cy="301" r="55" />
          <circle cx="738" cy="301" r="31" />
          <path d="M214 301 H322 M684 301 H792" />
        </g>

        <g className="genericVehicleSystem genericVehicleSystem-electronics" data-system="electronics" data-system-node="true">
          <rect x="530" y="194" width="58" height="41" rx="7" />
          <path d="M541 205 H577 M541 215 H577 M541 225 H564" />
          <path className="genericVehicleDataLine" d="M588 212 C610 207 619 201 631 193" />
          <path className="genericVehicleDataLine" d="M552 235 C545 257 529 273 509 287" />
        </g>

        <g className="genericVehicleWireCage">
          <path d="M180 257 L299 178 L391 111 L548 78 L665 95 L787 151 L860 220" />
          <path d="M205 286 L318 194 L405 129 L548 101 L648 116 L756 166 L825 237" />
          <path d="M299 178 L318 194 M391 111 L405 129 M548 78 L548 101 M665 95 L648 116 M787 151 L756 166" />
          <path d="M318 194 L298 268 M405 129 L413 267 M548 101 L552 267 M648 116 L637 267 M756 166 L699 279" />
          <path d="M299 178 L787 151 M318 194 L756 166 M298 268 L699 279" />
          <path d="M205 286 L184 306 M825 237 L817 304" />
        </g>
      </g>

      <path className="genericVehicleShell" d="M116 274 C137 222 199 188 292 170 L382 104 C426 72 479 62 546 68 L665 84 C716 91 757 111 793 145 L839 189 C874 199 899 220 908 250 L913 275 C917 291 906 303 886 304 H817 C808 251 778 225 738 225 C694 225 661 255 654 306 H352 C345 254 312 226 268 226 C225 226 193 255 184 306 H132 C107 306 101 289 116 274 Z" />
      <path className="genericVehicleShellLine" d="M292 170 L839 189" />
      <path className="genericVehicleShellLine" d="M382 104 L405 266 M546 68 L552 267 M665 84 L637 267" />
      <path className="genericVehicleShellLine" d="M184 306 L352 306 M654 306 L817 304" />
      <path className="genericVehiclePerspectiveLine" d="M132 281 L184 259 M886 281 L817 260" />

      <g className="genericVehicleRegions">
        {REGIONS.map((candidate) => (
          <RegionMarker key={candidate} region={candidate} active={candidate === region} />
        ))}
      </g>

      <g className="genericVehicleScanLayer" data-scan-layer="true" clipPath="url(#genericVehicleBodyClip)">
        <rect className="genericVehicleScanWash" x="100" y="55" width="825" height="280" fill="url(#genericVehicleScan)" />
        <path className="genericVehicleScanBeam" d="M125 108 H900" />
      </g>

      <g className="genericVehicleDiagnosticDots">
        <circle cx="759" cy="215" r="3" />
        <circle cx="835" cy="176" r="3" />
        <circle cx="508" cy="306" r="3" />
        <circle cx="383" cy="307" r="3" />
        <circle cx="268" cy="301" r="3" />
        <circle cx="738" cy="301" r="3" />
      </g>
    </svg>
  );
}
