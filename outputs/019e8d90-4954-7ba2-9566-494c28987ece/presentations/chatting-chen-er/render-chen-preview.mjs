import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
  saveBlobToFile,
} from "file:///C:/Users/COLORFUL/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-chen-er";
const pptxPath = `${workspace}/output/Chatting-ER图与关系模式讲解-陈氏ER版.pptx`;
const outDir = `${workspace}/preview`;

async function main() {
  await ensureArtifactToolWorkspace(workspace);
  const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  await fs.mkdir(outDir, { recursive: true });
  const slide = presentation.slides.getItem(3);
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  const out = path.join(outDir, "slide-04-chen.png");
  await saveBlobToFile(png, out);
  console.log(JSON.stringify({ out, slideCount: presentation.slides.count }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
