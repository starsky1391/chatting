import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
  saveBlobToFile,
} from "file:///C:/Users/COLORFUL/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-add-full-er";
const pptxPath = `${workspace}/output/Chatting-ER图与关系模式讲解-含ER总图-英文行内注释版.pptx`;
const outDir = `${workspace}/preview-inline`;
const previewSlides = [0, 3, 9, 10];

async function main() {
  await ensureArtifactToolWorkspace(workspace);
  const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  await fs.mkdir(outDir, { recursive: true });

  for (const index of previewSlides) {
    const slide = presentation.slides.getItem(index);
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    const fileName = `slide-${String(index + 1).padStart(2, "0")}.png`;
    await saveBlobToFile(png, path.join(outDir, fileName));
  }

  console.log(JSON.stringify({ outDir, slideCount: presentation.slides.count }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
