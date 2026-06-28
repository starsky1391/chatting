import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
} from "file:///C:/Users/COLORFUL/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-add-full-er";
const input = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-relationship/output/Chatting-ER图与关系模式讲解.pptx";

async function main() {
  await ensureArtifactToolWorkspace(workspace);
  const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
  const slide = presentation.slides.getItem(0);
  console.log("elements", slide.elements?.count, typeof slide.elements?.getItem);
  console.log("shapes", slide.shapes?.count, typeof slide.shapes?.getItem);
  for (let i = 0; i < (slide.elements?.count || 0); i += 1) {
    const el = slide.elements.getItem(i);
    console.log("EL", i, Object.getPrototypeOf(el)?.constructor?.name, el.text, el.position);
  }
  for (let i = 0; i < (slide.shapes?.count || 0); i += 1) {
    const s = slide.shapes.getItem(i);
    console.log("SH", i, s.text, s.position);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
