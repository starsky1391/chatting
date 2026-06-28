import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
} from "file:///C:/Users/COLORFUL/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-add-full-er";
const pptxPath = `${workspace}/output/Chatting-ER图与关系模式讲解-含ER总图.pptx`;

async function main() {
  await ensureArtifactToolWorkspace(workspace);
  const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  const slide = presentation.slides.getItem(0);

  for (let i = 0; i < Math.min(slide.shapes.items.length, 8); i += 1) {
    const shape = slide.shapes.items[i];
    try {
      const got = shape.text.get();
      console.log("idx", i, "get", JSON.stringify(got));
    } catch (error) {
      console.log("idx", i, "get ERR", error.message);
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
