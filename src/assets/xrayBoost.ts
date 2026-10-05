import part0 from "./xrayBoostPart0";
import part1 from "./xrayBoostPart1";
import part2 from "./xrayBoostPart2";
import part3 from "./xrayBoostPart3";
import part4 from "./xrayBoostPart4";
import part5 from "./xrayBoostPart5";

const payload = part0 + part1 + part2 + part3 + part4 + part5;

export const XRAY_BOOST_SRC = `data:image/webp;base64,${payload}`;
export const XRAY_BOOST_BASE64_LENGTH = payload.length;
