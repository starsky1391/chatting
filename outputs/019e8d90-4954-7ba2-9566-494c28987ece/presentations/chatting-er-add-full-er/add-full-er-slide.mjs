import path from "node:path";
import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
} from "file:///C:/Users/COLORFUL/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-add-full-er";
const input = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-relationship/output/Chatting-ER图与关系模式讲解.pptx";
const output = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-add-full-er/output/Chatting-ER图与关系模式讲解-含ER总图.pptx";

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
  line: "#D6D0C7",
  dark: "#263241",
};

function shape(slide, x, y, w, h, fill = C.panel, line = C.line, geometry = "rect") {
  return slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
  });
}

function text(slide, value, x, y, w, h, opts = {}) {
  const s = shape(slide, x, y, w, h, opts.fill || "#00000000", "#00000000");
  s.text = value;
  s.text.fontSize = opts.size || 12;
  s.text.color = opts.color || C.ink;
  s.text.bold = Boolean(opts.bold);
  s.text.typeface = opts.face || "Aptos";
  s.text.alignment = opts.align || "left";
  s.text.verticalAlignment = opts.valign || "top";
  s.text.insets = opts.insets || { left: 0, right: 0, top: 0, bottom: 0 };
  return s;
}

function hline(slide, x1, y, x2, color = C.muted) {
  shape(slide, Math.min(x1, x2), y, Math.abs(x2 - x1), 1.8, color, color);
}

function vline(slide, x, y1, y2, color = C.muted) {
  shape(slide, x, Math.min(y1, y2), 1.8, Math.abs(y2 - y1), color, color);
}

function connector(slide, x1, y1, x2, y2, color = C.muted) {
  if (Math.abs(x1 - x2) < 2) {
    vline(slide, x1, y1, y2, color);
  } else if (Math.abs(y1 - y2) < 2) {
    hline(slide, x1, y1, x2, color);
  } else {
    const mid = (x1 + x2) / 2;
    hline(slide, x1, y1, mid, color);
    vline(slide, mid, y1, y2, color);
    hline(slide, mid, y2, x2, color);
  }
}

function busLabel(slide, value, x, y, color) {
  text(slide, value, x, y, 78, 18, { size: 9, color, align: "center", fill: C.paper, valign: "middle" });
}

function entity(slide, { x, y, w = 145, h = 64, name, fields, color }) {
  shape(slide, x, y, w, h, "#FFFFFF", color);
  shape(slide, x, y, w, 20, color, color);
  text(slide, name, x + 6, y + 3, w - 12, 14, { size: 9.5, bold: true, color: "#FFFFFF", valign: "middle" });
  text(slide, fields.join("\n"), x + 7, y + 27, w - 14, h - 29, { size: 8.2, color: C.ink });
}

async function main() {
  await ensureArtifactToolWorkspace(workspace);
  const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
  const slide = presentation.slides.add();
  slide.moveTo(3);

  shape(slide, 0, 0, 1280, 720, C.paper, C.paper);
  shape(slide, 68, 55.5, 9, 9, C.red, C.red);
  text(slide, "FULL ER DIAGRAM", 88, 48, 360, 24, { size: 12, bold: true, color: C.red, valign: "middle" });
  text(slide, "完整 ER 总图把 12 张主业务表和四类关系放在同一张图里。", 68, 82, 1000, 48, {
    size: 30,
    bold: true,
    color: C.ink,
    face: "Aptos Display",
  });
  text(slide, "按业务域分区阅读：左侧是 Group/频道消息，右侧是好友与私信，中间 USERS 是全模型枢纽。", 72, 130, 960, 24, { size: 14, color: C.muted });

  const nodes = {
    users: { x: 548, y: 208, w: 170, h: 82, name: "USERS", color: C.red, fields: ["id PK", "email UK", "username", "role / online"] },
    groups: { x: 84, y: 196, w: 170, h: 70, name: "CHANNEL_GROUPS", color: C.teal, fields: ["owner_id FK", "invite_code UK"] },
    channels: { x: 84, y: 326, w: 170, h: 68, name: "CHANNELS", color: C.teal, fields: ["group_id FK", "type / position"] },
    messages: { x: 84, y: 500, w: 170, h: 68, name: "MESSAGES", color: C.blue, fields: ["sender_id FK", "channel_id FK"] },
    roles: { x: 302, y: 196, w: 156, h: 64, name: "GROUP_ROLES", color: C.green, fields: ["group_id FK", "name / position"] },
    userGroups: { x: 302, y: 326, w: 156, h: 68, name: "USER_GROUPS", color: C.amber, fields: ["user_id FK", "group_id FK", "role"] },
    userChannels: { x: 302, y: 500, w: 156, h: 64, name: "USER_CHANNELS", color: C.amber, fields: ["user_id FK", "channel_id FK"] },
    requests: { x: 812, y: 186, w: 178, h: 68, name: "FRIEND_REQUESTS", color: C.green, fields: ["requester_id FK", "addressee_id FK", "status"] },
    friends: { x: 812, y: 304, w: 178, h: 62, name: "FRIENDSHIPS", color: C.green, fields: ["user_id FK", "friend_id FK"] },
    dmConv: { x: 1034, y: 298, w: 190, h: 68, name: "DIRECT_CONVERSATIONS", color: C.blue, fields: ["id PK", "pair_key UK", "last_message_at"] },
    dmMembers: { x: 812, y: 500, w: 204, h: 64, name: "DIRECT_CONVERSATION_MEMBERS", color: C.amber, fields: ["direct_conversation_id FK", "user_id FK"] },
    dmMessages: { x: 1034, y: 500, w: 190, h: 64, name: "DIRECT_MESSAGES", color: C.blue, fields: ["conversation_id FK", "sender_id FK"] },
  };
  shape(slide, 64, 174, 474, 426, "#FFFFFF66", C.line);
  shape(slide, 770, 174, 474, 426, "#FFFFFF66", C.line);
  shape(slide, 528, 174, 238, 426, "#FFF8F3", C.line);
  Object.values(nodes).forEach((n) => entity(slide, n));

  text(slide, "Group / 频道 / 消息域", 78, 156, 180, 18, { size: 12, bold: true, color: C.teal });
  text(slide, "用户中心", 582, 156, 130, 18, { size: 12, bold: true, color: C.red, align: "center" });
  text(slide, "好友 / 私信域", 846, 156, 180, 18, { size: 12, bold: true, color: C.green });

  hline(slide, 458, 232, 548, C.red);
  busLabel(slide, "owns", 484, 218, C.red);
  hline(slide, 458, 360, 548, C.amber);
  busLabel(slide, "joins", 484, 346, C.amber);
  hline(slide, 458, 532, 548, C.amber);
  busLabel(slide, "active", 484, 518, C.amber);
  hline(slide, 718, 221, 812, C.green);
  busLabel(slide, "requests", 734, 207, C.green);
  hline(slide, 718, 335, 812, C.green);
  busLabel(slide, "friends", 734, 321, C.green);
  hline(slide, 718, 532, 812, C.amber);
  busLabel(slide, "member", 734, 518, C.amber);

  vline(slide, 169, 266, 326, C.teal);
  busLabel(slide, "contains", 180, 291, C.teal);
  vline(slide, 169, 394, 500, C.blue);
  busLabel(slide, "has", 180, 444, C.blue);
  hline(slide, 254, 228, 302, C.green);
  busLabel(slide, "roles", 262, 214, C.green);
  hline(slide, 254, 360, 302, C.amber);
  hline(slide, 254, 532, 302, C.amber);
  hline(slide, 990, 335, 1034, C.blue);
  busLabel(slide, "pair_key", 990, 318, C.blue);
  hline(slide, 1016, 532, 1034, C.blue);
  vline(slide, 1129, 366, 500, C.blue);

  shape(slide, 548, 338, 170, 74, "#FFFFFF", C.red);
  text(slide, "读图规则", 566, 350, 130, 18, { size: 14, bold: true, color: C.red, align: "center" });
  text(slide, "实体表存对象\n中间表存多对多\n消息表存时间序列", 564, 376, 140, 38, { size: 10.5, color: C.muted, align: "center" });

  text(slide, "所有表默认包含 created_at / updated_at / deleted_at；deleted_at 支撑撤回、软删除和审计。", 72, 674, 900, 20, { size: 12, color: C.muted });
  text(slide, "04", 1178, 642, 50, 24, { size: 12, color: C.muted, align: "right" });

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(output);
  console.log(JSON.stringify({ output, slideCount: presentation.slides.count }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
