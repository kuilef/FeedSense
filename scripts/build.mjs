import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const isDebugBuild = process.env.FEEDSENSE_DEBUG === "1";
const outdir = isDebugBuild ? "dist-debug" : "dist";

await rm(outdir, { recursive: true, force: true });
await execFileAsync("tsc", ["-p", "tsconfig.build.json", "--outDir", outdir]);

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

const manifestSource = JSON.parse(await readFile("src/manifest.json", "utf8"));
if (isDebugBuild) {
  manifestSource.name = `${manifestSource.name} Debug`;
  manifestSource.description = `[DEBUG] ${manifestSource.description}`;
}

for (const contentScript of manifestSource.content_scripts ?? []) {
  contentScript.js = isDebugBuild ? ["content/debugBootstrap.js", "content/index.js"] : ["content/index.js"];
}

const manifestTarget = `${outdir}/manifest.json`;
await mkdir(dirname(manifestTarget), { recursive: true });
await writeFile(manifestTarget, JSON.stringify(manifestSource, null, 2), "utf8");

const htmlAsset = "src/options/index.html";
const htmlTarget = htmlAsset.replace(/^src\//, `${outdir}/`);
await mkdir(dirname(htmlTarget), { recursive: true });
await cp(htmlAsset, htmlTarget);

console.log(`Build completed. Load ${outdir}/ as unpacked extension in Chrome.`);
