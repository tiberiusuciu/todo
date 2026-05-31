import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPkg = resolve(__dirname, "../../package.json");
const serverPkg = resolve(__dirname, "../package.json");

const { version } = JSON.parse(
  readFileSync(existsSync(rootPkg) ? rootPkg : serverPkg, "utf8")
) as { version: string };

export function getAppVersion(): string {
  return version;
}
