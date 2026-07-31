import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readBridgeVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const BRIDGE_VERSION = readBridgeVersion();
