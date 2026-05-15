import fs from "node:fs/promises";
import path from "node:path";

const artifactToolPath =
  "file:///C:/Users/mailt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const { PresentationFile } = await import(artifactToolPath);

const pptxPath = path.resolve("artifacts/leadership-demo/output/Boundaryless-WorkOS_Leadership_Demo_Screenshot_Driven.pptx");
const outputDir = path.resolve("artifacts/leadership-demo/pptx-parity-previews");

await fs.mkdir(outputDir, { recursive: true });
for (const file of await fs.readdir(outputDir).catch(() => [])) {
  await fs.rm(path.join(outputDir, file), { force: true });
}

const bytes = await fs.readFile(pptxPath);
const presentation = await PresentationFile.importPptx(bytes);
const previews = [];

for (let index = 0; index < presentation.slides.count; index += 1) {
  const blob = await presentation.slides.getItem(index).export({ format: "png" });
  const file = path.join(outputDir, `slide-${String(index + 1).padStart(2, "0")}.png`);
  await fs.writeFile(file, Buffer.from(await blob.arrayBuffer()));
  previews.push(file);
}

console.log(JSON.stringify({ pptxPath, outputDir, count: previews.length }, null, 2));
