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

export function VehicleBodyShell({ variant }: { variant: string }) {
  const outline = BODY_OUTLINES[variant] ?? BODY_OUTLINES.generic;
  return (
    <g className="vehicleBodyShell" data-vehicle-body={variant} aria-hidden="true">
      <path className="vehicleBodyOutline" d={outline} />
      <path className="vehicleBodyGlass" d={glassPath(variant)} />
      <path className="vehicleBodyBeltline" d="M118 239 C 285 223, 560 218, 824 241" />
      <path className="vehicleBodyFloor" d="M145 283 C 330 300, 612 301, 803 282" />
      <circle className="vehicleBodyWheel" cx="215" cy="286" r="36" />
      <circle className="vehicleBodyWheel" cx="716" cy="286" r="36" />
      <circle className="vehicleBodyHub" cx="215" cy="286" r="15" />
      <circle className="vehicleBodyHub" cx="716" cy="286" r="15" />
    </g>
  );
}
