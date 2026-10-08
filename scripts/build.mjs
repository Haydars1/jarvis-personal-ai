import fs from "node:fs";
import crypto from "node:crypto";
import AdmZip from "adm-zip";

const archiveUrl = "https://6006-performance.floot.app/_cdn/static/2e6d5cc2-19fa-4ff2-b7e3-e989b3788eed-6006coding-source-release.zip";
const expectedSha256 = "586d1cd9eee85c7cb861c8dd03470ba97a1b7143d75b0b351beb0813cc236df0";

const response = await fetch(archiveUrl, { signal: AbortSignal.timeout(45000) });
if (!response.ok) throw new Error("Source download failed: HTTP " + response.status);
const bytes = Buffer.from(await response.arrayBuffer());
const actual = crypto.createHash("sha256").update(bytes).digest("hex");
if (actual !== expectedSha256) throw new Error("Archive integrity check failed. Aborting deployment.");

const releaseDir = ".6006-release";
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });
const zip = new AdmZip(bytes);
if (zip.getEntries().some(e => e.entryName.startsWith("../") || e.entryName.includes("/../"))) throw new Error("Unsafe zip entry");
zip.extractAllTo(releaseDir, true);
if (!fs.existsSync(releaseDir + "/public/index.html")) throw new Error("Missing release public/index.html");
fs.rmSync("public", { recursive: true, force: true });
fs.cpSync(releaseDir + "/public", "public", { recursive: true });
const data = JSON.parse(fs.readFileSync("public/assets/6006-dtc-catalog.json", "utf8"));
if (!Array.isArray(data.defs) || data.defs.length < 18000) throw new Error("Arıza kodu kataloğu eksik");
for (const key of ["index.html","fehlercodes/index.html","technik/index.html","reparatur-wartung/index.html","fahrzeug/index.html"]) {
 if (!fs.existsSync("public/"+key)) throw new Error("Missing page: "+key);
}
for (const type of ["turbo","dpf","adblue","egr","fuel","transmission","brake","network","airbag","cooling","oil","steering","ignition","sensor","catalyst","body","generic"]) {
 if (!fs.existsSync("public/assets/realparts/"+type+".webp")) throw new Error("Missing system image "+type);
}
console.log("6006 site ready:", data.defs.length, "DTC definitions, 17 illustrated systems, 5 pages.");
