type BodySpec = {
  modelKey: string;
  outline: string;
  glass: string;
  beltline: string;
  characterLine: string;
  hood: string;
  rearDetail: string;
  roofRail?: string;
  frontWheelX: number;
  rearWheelX: number;
  doorXs: [number, number];
};

const BODY_SPECS: Record<string, BodySpec> = {
  "wagon-fwd-long": {
    modelKey: "vw-passat-b8-variant",
    outline: "M72 278 L83 250 Q90 238 109 231 L169 211 L264 171 Q279 162 298 160 L610 159 Q637 160 655 171 L718 205 L813 226 Q846 233 870 256 L877 276 Q870 292 845 297 L765 300 Q758 261 718 258 Q677 258 668 300 L265 300 Q258 261 216 258 Q176 258 168 300 L104 298 Q82 296 72 278 Z",
    glass: "M284 173 L319 170 L589 170 Q620 171 640 183 L692 211 L584 207 L577 178 L454 177 L451 207 L326 208 Z",
    beltline: "M111 231 C294 213 604 210 821 232",
    characterLine: "M126 247 C315 235 583 234 800 246",
    hood: "M704 207 C753 210 811 222 853 247",
    rearDetail: "M96 242 C132 226 169 214 214 207",
    roofRail: "M301 153 C386 147 526 147 611 153",
    frontWheelX: 716,
    rearWheelX: 216,
    doorXs: [355, 540],
  },
  "sedan-rwd-longnose": {
    modelKey: "bmw-g20",
    outline: "M67 279 L80 251 Q88 240 111 232 L187 215 L286 191 L349 149 Q362 140 382 139 L531 139 Q553 140 568 151 L624 190 L755 211 L829 229 Q858 238 875 259 L878 278 Q868 294 842 298 L767 300 Q758 261 716 258 Q675 258 667 300 L264 300 Q256 261 214 258 Q174 258 166 300 L102 298 Q79 296 67 279 Z",
    glass: "M310 190 L365 151 L520 151 Q539 152 551 161 L602 194 L515 190 L507 158 L395 158 L386 191 Z",
    beltline: "M112 233 C318 219 603 216 824 236",
    characterLine: "M134 249 C327 239 593 238 799 249",
    hood: "M620 192 C690 197 780 214 852 248",
    rearDetail: "M101 241 C147 226 185 216 244 205",
    frontWheelX: 716,
    rearWheelX: 214,
    doorXs: [401, 557],
  },
  "estate-rwd-longnose": {
    modelKey: "mercedes-s213",
    outline: "M66 281 L79 249 Q87 236 109 228 L181 209 L278 166 L318 139 Q330 131 347 130 L610 130 Q637 131 656 145 L713 188 L792 210 L839 224 Q861 233 876 253 L880 274 Q872 292 844 298 L760 301 Q751 260 711 257 Q670 257 661 301 L263 301 Q254 260 214 257 Q172 257 164 301 L103 299 Q78 296 66 281 Z",
    glass: "M289 169 L329 143 L590 143 Q617 144 636 157 L687 193 L605 190 L596 150 L475 149 L469 192 L347 194 Z",
    beltline: "M110 228 C297 215 593 213 818 232",
    characterLine: "M126 246 C320 235 594 235 807 246",
    hood: "M707 190 C755 198 818 217 858 246",
    rearDetail: "M94 239 C135 221 177 211 230 198",
    roofRail: "M331 123 C413 117 530 117 603 123",
    frontWheelX: 711,
    rearWheelX: 214,
    doorXs: [384, 548],
  },
  "hatch-fwd-short": {
    modelKey: "ford-focus-mk4",
    outline: "M76 281 L88 251 Q96 240 119 231 L188 212 L278 169 Q292 161 311 159 L548 159 Q575 161 595 178 L652 206 L774 225 Q823 233 856 258 L862 278 Q854 293 829 298 L752 300 Q744 262 704 259 Q663 259 654 300 L271 300 Q262 262 220 259 Q180 259 171 300 L111 299 Q88 296 76 281 Z",
    glass: "M299 174 L330 170 L526 170 Q551 172 571 186 L620 210 L539 207 L529 177 L414 176 L407 208 L327 208 Z",
    beltline: "M119 231 C291 218 555 217 795 237",
    characterLine: "M137 249 C309 239 548 239 776 251",
    hood: "M650 208 C706 210 790 224 840 250",
    rearDetail: "M105 241 C145 225 184 215 229 205",
    frontWheelX: 704,
    rearWheelX: 220,
    doorXs: [384, 530],
  },
  "generic-engine": {
    modelKey: "generic",
    outline: "M65 272 L96 247 L174 224 L294 155 L594 154 L704 198 L810 225 L868 269 L843 289 L770 295 L132 295 L84 287 Z",
    glass: "M230 216 L310 168 L582 167 L666 202 Z",
    beltline: "M112 238 C292 220 572 216 831 242",
    characterLine: "M128 252 C310 240 584 240 807 252",
    hood: "M690 204 C744 207 797 222 839 247",
    rearDetail: "M100 247 C143 229 181 222 224 218",
    frontWheelX: 716,
    rearWheelX: 215,
    doorXs: [300, 555],
  },
};

BODY_SPECS.generic = BODY_SPECS["generic-engine"];

function wheel(cx: number) {
  return (
    <g className="vehicleBodyWheelAssembly">
      <circle className="vehicleBodyWheel" cx={cx} cy="300" r="40" />
      <circle className="vehicleBodyTireInner" cx={cx} cy="300" r="31" />
      <g className="vehicleBodyRim">
        <circle cx={cx} cy="300" r="20" />
        <path d={`M${cx} 282 V318 M${cx - 18} 300 H${cx + 18} M${cx - 13} 287 L${cx + 13} 313 M${cx + 13} 287 L${cx - 13} 313`} />
      </g>
      <circle className="vehicleBodyHub" cx={cx} cy="300" r="5" />
    </g>
  );
}

export function VehicleBodyShell({ variant }: { variant: string }) {
  const spec = BODY_SPECS[variant] ?? BODY_SPECS.generic;
  const [frontDoorX, rearDoorX] = spec.doorXs;

  return (
    <g
      className="vehicleBodyShell"
      data-vehicle-body={variant}
      data-vehicle-body-model={spec.modelKey}
      aria-hidden="true"
    >
      <path className="vehicleBodyAura" d={spec.outline} />
      <path className="vehicleBodyOutline" d={spec.outline} />
      <path className="vehicleBodyGlass" d={spec.glass} />
      <path className="vehicleBodyHood" d={spec.hood} />
      <path className="vehicleBodyTrunk" d={spec.rearDetail} />
      <path className="vehicleBodyBeltline" d={spec.beltline} />
      <path className="vehicleBodyCharacterLine" d={spec.characterLine} />
      <path className="vehicleBodyDoor" d={`M${frontDoorX} 205 L${frontDoorX} 278 M${rearDoorX} 204 L${rearDoorX} 279`} />
      <path className="vehicleBodyFloor" d="M145 286 C330 302 612 303 803 285" />
      <path className="vehicleBodyPillar" d={`M${frontDoorX + 22} 150 L${frontDoorX + 22} 204 M${rearDoorX + 20} 151 L${rearDoorX + 20} 204`} />
      {spec.roofRail ? <path className="vehicleBodyRoofRail" d={spec.roofRail} /> : null}
      <path className="vehicleBodyLamp vehicleBodyLampRear" d="M83 258 L116 247 L129 254 L100 268 Z" />
      <path className="vehicleBodyLamp vehicleBodyLampFront" d="M835 243 L869 258 L855 270 L825 257 Z" />
      <path className="vehicleBodyLowerIntake" d="M774 270 C810 267 836 269 855 278" />
      <path className="vehicleBodySill" d="M264 286 C388 292 551 292 661 287" />
      {wheel(spec.rearWheelX)}
      {wheel(spec.frontWheelX)}
      <path className="vehicleBodyBaseline" d="M70 334 H882" />
    </g>
  );
}
