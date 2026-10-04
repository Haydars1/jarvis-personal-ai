const BODY_OUTLINES: Record<string, string> = {
  "wagon-fwd-long": "M62 271 L91 248 L166 224 L286 151 L610 151 L704 195 L815 222 L873 264 L854 286 L776 294 L129 294 L79 286 Z",
  "sedan-rwd-longnose": "M58 271 L91 246 L167 225 L279 194 L356 140 L518 136 L614 187 L750 210 L842 239 L876 270 L850 288 L775 295 L128 295 L76 286 Z",
  "estate-rwd-longnose": "M58 271 L91 246 L169 224 L303 144 L635 146 L724 194 L821 222 L878 269 L852 288 L775 295 L128 295 L76 286 Z",
  "hatch-fwd-short": "M75 272 L105 246 L180 222 L285 157 L565 155 L679 197 L790 225 L854 269 L830 289 L760 296 L140 296 L94 288 Z",
  "generic-engine": "M65 272 L96 247 L174 224 L294 155 L594 154 L704 198 L810 225 L868 269 L843 289 L770 295 L132 295 L84 287 Z",
  generic: "M65 272 L96 247 L174 224 L294 155 L594 154 L704 198 L810 225 L868 269 L843 289 L770 295 L132 295 L84 287 Z",
};

function glassPath(variant: string) {
  if (variant === "sedan-rwd-longnose") return "M294 195 L365 151 L507 149 L586 190 Z";
  if (variant === "hatch-fwd-short") return "M222 218 L296 169 L551 168 L642 205 Z";
  if (variant === "wagon-fwd-long" || variant === "estate-rwd-longnose") return "M218 217 L310 160 L610 160 L686 199 Z";
  return "M230 216 L310 168 L582 167 L666 202 Z";
}

function rearDoorStart(variant: string) {
  return variant === "hatch-fwd-short" ? 530 : 555;
}

export function VehicleBodyShell({ variant }: { variant: string }) {
  const outline = BODY_OUTLINES[variant] ?? BODY_OUTLINES.generic;
  const rearDoorX = rearDoorStart(variant);

  return (
    <g className="vehicleBodyShell" data-vehicle-body={variant} aria-hidden="true">
      <path className="vehicleBodyAura" d={outline} />
      <path className="vehicleBodyOutline" d={outline} />
      <path className="vehicleBodyGlass" d={glassPath(variant)} />
      <path className="vehicleBodyPillar" d="M390 154 L390 202 M558 154 L558 199" />
      <path className="vehicleBodyHood" d="M690 204 C 744 207 797 222 839 247" />
      <path className="vehicleBodyTrunk" d="M100 247 C 143 229 181 222 224 218" />
      <path className="vehicleBodyBeltline" d="M112 238 C 292 220 572 216 831 242" />
      <path className="vehicleBodyDoor" d={`M300 208 L300 278 M ${rearDoorX} 205 L ${rearDoorX} 279`} />
      <path className="vehicleBodyFloor" d="M145 283 C 330 300 612 301 803 282" />
      <path className="vehicleBodyLamp vehicleBodyLampRear" d="M83 258 L113 247 L126 254 L101 267 Z" />
      <path className="vehicleBodyLamp vehicleBodyLampFront" d="M836 244 L866 260 L853 270 L826 256 Z" />
      <circle className="vehicleBodyWheel" cx="215" cy="286" r="38" />
      <circle className="vehicleBodyWheel" cx="716" cy="286" r="38" />
      <g className="vehicleBodyRim">
        <circle cx="215" cy="286" r="20" />
        <path d="M215 268 V304 M197 286 H233 M202 273 L228 299 M228 273 L202 299" />
      </g>
      <g className="vehicleBodyRim">
        <circle cx="716" cy="286" r="20" />
        <path d="M716 268 V304 M698 286 H734 M703 273 L729 299 M729 273 L703 299" />
      </g>
      <circle className="vehicleBodyHub" cx="215" cy="286" r="6" />
      <circle className="vehicleBodyHub" cx="716" cy="286" r="6" />
      <path className="vehicleBodyBaseline" d="M74 316 H874" />
    </g>
  );
}
