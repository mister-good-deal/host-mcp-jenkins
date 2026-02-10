import { readFileSync } from "fs";

interface PackageJson {
    version: string;
    [key: string]: unknown;
}

const pkg: PackageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf-8")
);

export const VERSION: string = pkg.version;
