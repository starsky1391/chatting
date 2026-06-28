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
  for (const slideIndex of [0, 1, 3]) {
    const slide = presentation.slides.getItem(slideIndex);
    console.log(`-- slide ${slideIndex + 1} --`);
    slide.shapes.items.slice(0, 3).forEach((shape, i) => {
      try {
        console.log("idx", i, "type", shape.type, "textCtor", Object.getPrototypeOf(shape.text)?.constructor?.name);
        console.log("textOwn", Object.getOwnPropertyNames(shape.text));
        console.log("textProto", Object.getOwnPropertyNames(Object.getPrototypeOf(shape.text)).slice(0, 80));
        for (const key of ["text", "value", "runs", "paragraphs", "items", "plainText"]) {
          try {
            const v = typeof shape.text[key] === "function" ? shape.text[key]() : shape.text[key];
            console.log("  ", key, v);
          } catch (error) {
            console.log("  ", key, "ERR", error.message);
          }
        }
      } catch (error) {
        console.log("idx", i, "ERR", error.message);
      }
    });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
