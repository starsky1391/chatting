import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
} from "file:///C:/Users/COLORFUL/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-add-full-er";
const pptxPath = `${workspace}/output/Chatting-ER图与关系模式讲解-含ER总图.pptx`;

function describe(name, value) {
  const proto = value && Object.getPrototypeOf(value);
  console.log(`## ${name}`);
  console.log("type", typeof value);
  console.log("ctor", proto?.constructor?.name);
  console.log("own", value ? Object.getOwnPropertyNames(value).slice(0, 40) : []);
  console.log("proto", proto ? Object.getOwnPropertyNames(proto).slice(0, 80) : []);
}

async function main() {
  await ensureArtifactToolWorkspace(workspace);
  const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  const slide = presentation.slides.getItem(0);

  describe("presentation.slides", presentation.slides);
  describe("slide", slide);
  describe("slide.shapes", slide.shapes);
  describe("slide.elements", slide.elements);

  const shapeCollection = slide.shapes;
  const keys = ["count", "length", "size"];
  for (const key of keys) {
    try {
      console.log("shape collection", key, shapeCollection?.[key], typeof shapeCollection?.[key]);
    } catch (error) {
      console.log("shape collection", key, "ERR", error.message);
    }
  }

  const proto = Object.getPrototypeOf(shapeCollection);
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (typeof shapeCollection[name] === "function") {
      console.log("fn", name);
    }
  }

  for (const candidate of ["count", "length", "size", "items"]) {
    try {
      const v = typeof shapeCollection[candidate] === "function" ? shapeCollection[candidate]() : shapeCollection[candidate];
      console.log("candidate", candidate, v);
    } catch (error) {
      console.log("candidate", candidate, "ERR", error.message);
    }
  }

  for (const method of ["getItem", "at", "item", "toArray"]) {
    try {
      if (typeof shapeCollection[method] === "function") {
        const r = method === "toArray" ? shapeCollection[method]() : shapeCollection[method](0);
        console.log("method result", method, r ? Object.getPrototypeOf(r)?.constructor?.name : r);
        if (r) {
          console.log("method result own", Object.getOwnPropertyNames(r).slice(0, 30));
          console.log("method result proto", Object.getOwnPropertyNames(Object.getPrototypeOf(r)).slice(0, 60));
        }
      }
    } catch (error) {
      console.log("method", method, "ERR", error.message);
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
