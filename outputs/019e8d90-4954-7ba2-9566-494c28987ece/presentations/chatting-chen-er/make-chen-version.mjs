import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
} from "file:///C:/Users/COLORFUL/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-chen-er";
const input = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-add-full-er/output/Chatting-ER图与关系模式讲解-含ER总图-英文行内注释版.pptx";
const output = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-chen-er/output/Chatting-ER图与关系模式讲解-陈氏ER版.pptx";

const C = {
  ink: "#18202A",
  muted: "#667085",
  paper: "#F7F2EA",
  panel: "#FFFFFF",
  red: "#C84A3A",
  teal: "#1F8A8A",
  green: "#5A8F55",
  blue: "#3B67B2",
  amber: "#C98B2E",
  plum: "#915A7A",
  line: "#D6D0C7",
  dark: "#263241",
};

function shape(slide, x, y, w, h, fill = C.panel, line = C.line, geometry = "rect") {
  return slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1.2 },
  });
}

function text(slide, value, x, y, w, h, opts = {}) {
  const s = shape(slide, x, y, w, h, opts.fill || "#00000000", opts.line || "#00000000");
  s.text = value;
  s.text.fontSize = opts.size || 12;
  s.text.color = opts.color || C.ink;
  s.text.bold = Boolean(opts.bold);
  s.text.typeface = opts.face || "Aptos";
  s.text.alignment = opts.align || "left";
  s.text.verticalAlignment = opts.valign || "middle";
  s.text.insets = opts.insets || { left: 2, right: 2, top: 2, bottom: 2 };
  return s;
}

function line(slide, x1, y1, x2, y2, color = C.muted, thickness = 1.6) {
  if (Math.abs(x1 - x2) < 2) {
    shape(slide, x1, Math.min(y1, y2), thickness, Math.abs(y2 - y1), color, color);
    return;
  }
  if (Math.abs(y1 - y2) < 2) {
    shape(slide, Math.min(x1, x2), y1, Math.abs(x2 - x1), thickness, color, color);
    return;
  }
  const midX = (x1 + x2) / 2;
  line(slide, x1, y1, midX, y1, color, thickness);
  line(slide, midX, y1, midX, y2, color, thickness);
  line(slide, midX, y2, x2, y2, color, thickness);
}

function card(slide, cfg) {
  shape(slide, cfg.x, cfg.y, cfg.w, cfg.h, "#FFFFFF", cfg.color);
  text(slide, cfg.label, cfg.x + 8, cfg.y + 10, cfg.w - 16, 22, {
    size: cfg.size || 16,
    bold: true,
    color: cfg.color,
    align: "center",
  });
  if (cfg.sub) {
    text(slide, cfg.sub, cfg.x + 10, cfg.y + cfg.h - 26, cfg.w - 20, 16, {
      size: 9.5,
      color: C.muted,
      align: "center",
    });
  }
}

function entity(slide, cfg) {
  card(slide, { ...cfg, geometry: "rect" });
}

function relation(slide, cfg) {
  shape(slide, cfg.x, cfg.y, cfg.w, cfg.h, cfg.fill || "#FFF7EF", cfg.color, "diamond");
  text(slide, cfg.label, cfg.x + 8, cfg.y + 10, cfg.w - 16, cfg.h - 20, {
    size: cfg.size || 12,
    bold: true,
    color: cfg.color,
    align: "center",
  });
}

function attribute(slide, cfg) {
  shape(slide, cfg.x, cfg.y, cfg.w, cfg.h, "#FFFFFF", cfg.color, "ellipse");
  text(slide, cfg.label, cfg.x + 8, cfg.y + 9, cfg.w - 16, cfg.h - 18, {
    size: cfg.size || 10,
    color: cfg.color,
    align: "center",
  });
}

function cardinality(slide, value, x, y, color = C.muted) {
  return;
}

async function main() {
  await ensureArtifactToolWorkspace(workspace);
  const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(input));

  const oldSlide = presentation.slides.getItem(3);
  oldSlide.delete();

  const slide = presentation.slides.add();
  slide.moveTo(3);

  shape(slide, 0, 0, 1280, 720, C.paper, C.paper);
  shape(slide, 68, 55.5, 9, 9, C.red, C.red);
  text(slide, "CHEN ER DIAGRAM", 88, 48, 360, 24, {
    size: 12,
    bold: true,
    color: C.red,
  });
  text(slide, "陈氏 ER 图把中间表还原为“联系”，结构会更规整。", 68, 82, 980, 44, {
    size: 31,
    bold: true,
    color: C.ink,
    face: "Aptos Display",
  });
  text(slide, "矩形表示实体，椭圆表示属性，菱形表示联系。这里弱化外键细节，只保留核心业务语义与关键属性。", 72, 130, 980, 22, {
    size: 14,
    color: C.muted,
  });
  shape(slide, 64, 174, 560, 192, "#FFFFFF55", C.line);
  shape(slide, 656, 174, 568, 192, "#FFFFFF55", C.line);
  shape(slide, 64, 388, 560, 214, "#FFFFFF55", C.line);
  shape(slide, 656, 388, 568, 214, "#FFFFFF55", C.line);
  text(slide, "1. 群组成员", 84, 186, 150, 18, { size: 12, bold: true, color: C.amber });
  text(slide, "2. 群组结构", 676, 186, 150, 18, { size: 12, bold: true, color: C.teal });
  text(slide, "3. 频道消息", 84, 400, 150, 18, { size: 12, bold: true, color: C.blue });
  text(slide, "4. 好友私信", 676, 400, 150, 18, { size: 12, bold: true, color: C.green });

  entity(slide, { x: 124, y: 246, w: 112, h: 46, label: "用户", sub: "", color: C.red });
  relation(slide, { x: 314, y: 244, w: 76, h: 50, label: "加入\nN:M", color: C.amber, size: 10 });
  entity(slide, { x: 468, y: 246, w: 112, h: 46, label: "群组", sub: "", color: C.teal });
  attribute(slide, { x: 132, y: 206, w: 96, h: 28, label: "用户名", color: C.red, size: 10 });
  attribute(slide, { x: 470, y: 310, w: 108, h: 28, label: "邀请码", color: C.teal, size: 10 });
  line(slide, 180, 234, 180, 246, C.red, 2.2);
  line(slide, 524, 292, 524, 310, C.teal, 2.2);
  line(slide, 236, 269, 314, 269, C.amber, 2.1);
  line(slide, 390, 269, 468, 269, C.amber, 2.1);
  cardinality(slide, "N", 258, 251, C.amber);
  cardinality(slide, "M", 436, 251, C.amber);

  entity(slide, { x: 704, y: 246, w: 112, h: 46, label: "群组", sub: "", color: C.teal });
  relation(slide, { x: 878, y: 220, w: 74, h: 48, label: "包含\n1:N", color: C.teal, size: 10 });
  entity(slide, { x: 1048, y: 220, w: 112, h: 46, label: "频道", sub: "", color: C.teal });
  relation(slide, { x: 878, y: 292, w: 74, h: 48, label: "定义\n1:N", color: C.green, size: 10 });
  entity(slide, { x: 1042, y: 292, w: 124, h: 46, label: "角色组", sub: "", color: C.green });
  attribute(slide, { x: 1060, y: 180, w: 86, h: 28, label: "类型", color: C.teal, size: 10 });
  attribute(slide, { x: 1060, y: 342, w: 88, h: 28, label: "名称", color: C.green, size: 10 });
  line(slide, 1103, 208, 1103, 220, C.teal, 2.2);
  line(slide, 1104, 338, 1104, 342, C.green, 2.2);
  line(slide, 816, 269, 878, 244, C.teal, 2.1);
  line(slide, 952, 244, 1048, 243, C.teal, 2.1);
  line(slide, 816, 269, 878, 316, C.green, 2.1);
  line(slide, 952, 316, 1042, 315, C.green, 2.1);
  cardinality(slide, "1", 838, 246, C.teal);
  cardinality(slide, "N", 1014, 226, C.teal);
  cardinality(slide, "1", 838, 302, C.green);
  cardinality(slide, "N", 1012, 298, C.green);

  entity(slide, { x: 102, y: 484, w: 112, h: 46, label: "用户", sub: "", color: C.red });
  relation(slide, { x: 272, y: 482, w: 78, h: 50, label: "发送\n1:N", color: C.blue, size: 10 });
  entity(slide, { x: 410, y: 484, w: 132, h: 46, label: "频道消息", sub: "", color: C.blue });
  relation(slide, { x: 444, y: 420, w: 74, h: 48, label: "属于\nN:1", color: C.blue, size: 10 });
  entity(slide, { x: 524, y: 420, w: 86, h: 46, label: "频道", sub: "", color: C.teal });
  attribute(slide, { x: 424, y: 548, w: 104, h: 28, label: "时间", color: C.blue, size: 10 });
  line(slide, 476, 530, 476, 548, C.blue, 2.2);
  line(slide, 214, 507, 272, 507, C.blue, 2.1);
  line(slide, 350, 507, 410, 507, C.blue, 2.1);
  line(slide, 476, 484, 476, 468, C.blue, 2.1);
  line(slide, 518, 444, 524, 444, C.blue, 2.1);
  cardinality(slide, "1", 232, 490, C.blue);
  cardinality(slide, "N", 382, 490, C.blue);
  cardinality(slide, "N", 484, 470, C.blue);
  cardinality(slide, "1", 530, 424, C.blue);

  entity(slide, { x: 700, y: 448, w: 104, h: 44, label: "用户A", sub: "", color: C.red });
  relation(slide, { x: 878, y: 446, w: 96, h: 48, label: "申请/好友\n1:1", color: C.green, size: 9.5 });
  entity(slide, { x: 1080, y: 448, w: 104, h: 44, label: "用户B", sub: "", color: C.red });
  attribute(slide, { x: 888, y: 404, w: 78, h: 28, label: "状态", color: C.green, size: 10 });
  line(slide, 927, 432, 927, 446, C.green, 2.2);
  line(slide, 804, 470, 878, 470, C.green, 2.1);
  line(slide, 974, 470, 1080, 470, C.green, 2.1);
  cardinality(slide, "1", 826, 452, C.green);
  cardinality(slide, "1", 1042, 452, C.green);

  entity(slide, { x: 700, y: 550, w: 104, h: 44, label: "用户", sub: "", color: C.red });
  relation(slide, { x: 838, y: 548, w: 74, h: 48, label: "参与\nM:1", color: C.amber, size: 10 });
  entity(slide, { x: 930, y: 550, w: 116, h: 44, label: "私信会话", sub: "", color: C.blue });
  relation(slide, { x: 1058, y: 548, w: 64, h: 48, label: "包含\n1:N", color: C.blue, size: 9.5 });
  entity(slide, { x: 1128, y: 550, w: 92, h: 44, label: "私信消息", sub: "", color: C.blue });
  attribute(slide, { x: 962, y: 602, w: 100, h: 26, label: "会话键", color: C.blue, size: 10 });
  attribute(slide, { x: 1126, y: 514, w: 96, h: 24, label: "内容", color: C.blue, size: 10 });
  line(slide, 1012, 594, 1012, 602, C.blue, 2.2);
  line(slide, 1174, 538, 1174, 550, C.blue, 2.2);
  line(slide, 804, 572, 838, 572, C.amber, 2.1);
  line(slide, 912, 572, 930, 572, C.amber, 2.1);
  line(slide, 1046, 572, 1058, 572, C.blue, 2.1);
  line(slide, 1122, 572, 1128, 572, C.blue, 2.1);
  cardinality(slide, "M", 812, 554, C.amber);
  cardinality(slide, "1", 918, 554, C.amber);
  cardinality(slide, "1", 1042, 554, C.blue);
  cardinality(slide, "N", 1122, 554, C.blue);

  shape(slide, 76, 628, 254, 34, "#FFFFFF", C.line);
  text(slide, "图例：矩形=实体  椭圆=属性  菱形=联系", 88, 636, 220, 16, {
    size: 11,
    color: C.ink,
  });
  text(slide, "说明：为避免重叠，这里把陈氏 ER 图按业务关系拆成四个小图；用户A / 用户B 表示同一用户实体在私信场景中的两个角色。", 344, 632, 822, 18, {
    size: 11,
    color: C.muted,
  });

  text(slide, "04", 1178, 642, 50, 24, { size: 12, color: C.muted, align: "right" });

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(output);
  console.log(JSON.stringify({ output, slideCount: presentation.slides.count }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
