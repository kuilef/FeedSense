import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outdir = "dist";

await rm(outdir, { recursive: true, force: true });
await execFileAsync("tsc", ["-p", "tsconfig.build.json"]);

const needsJsExtension = /^\.{1,2}\//;

const patchImports = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await patchImports(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".js")) {
      continue;
    }

    const source = await readFile(fullPath, "utf8");
    const patched = source.replace(/from\s+"([^"]+)"/g, (match, specifier) => {
      if (!needsJsExtension.test(specifier) || /\.[a-z]+$/i.test(specifier)) {
        return match;
      }
      return `from "${specifier}.js"`;
    });

    await writeFile(fullPath, patched, "utf8");
  }
};

await patchImports(outdir);

const assets = ["src/manifest.json", "src/options/index.html"];
for (const asset of assets) {
  const target = asset.replace(/^src\//, `${outdir}/`);
  await mkdir(dirname(target), { recursive: true });
  await cp(asset, target);
}

console.log("Build completed. Load dist/ as unpacked extension in Chrome.");
