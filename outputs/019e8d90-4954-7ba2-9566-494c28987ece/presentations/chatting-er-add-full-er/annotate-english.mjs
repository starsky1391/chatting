import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
} from "file:///C:/Users/COLORFUL/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/presentations/chatting-er-add-full-er";
const input = `${workspace}/output/Chatting-ER图与关系模式讲解-含ER总图.pptx`;
const output = `${workspace}/output/Chatting-ER图与关系模式讲解-含ER总图-英文注释版.pptx`;

const C = {
  paper: "#F7F2EA",
  panel: "#FFFDF9",
  ink: "#18202A",
  muted: "#667085",
  red: "#C84A3A",
  line: "#D6D0C7",
};

function addShape(slide, x, y, w, h, fill, line = C.line) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
  });
}

function addText(slide, value, x, y, w, h, opts = {}) {
  const shape = addShape(slide, x, y, w, h, opts.fill || "#00000000", opts.line || "#00000000");
  shape.text = value;
  shape.text.fontSize = opts.size || 10;
  shape.text.color = opts.color || C.ink;
  shape.text.bold = Boolean(opts.bold);
  shape.text.typeface = opts.face || "Aptos";
  shape.text.alignment = opts.align || "left";
  shape.text.verticalAlignment = opts.valign || "top";
  shape.text.insets = opts.insets || { left: 0, right: 0, top: 0, bottom: 0 };
  return shape;
}

function addNote(slide, box) {
  addShape(slide, box.x, box.y, box.w, box.h, C.panel);
  addShape(slide, box.x, box.y, 4, box.h, C.red, C.red);
  addText(slide, "英文注释", box.x + 12, box.y + 8, box.w - 22, 16, {
    size: 11,
    bold: true,
    color: C.red,
    valign: "middle",
  });
  addText(slide, box.lines.join("\n"), box.x + 12, box.y + 28, box.w - 22, box.h - 34, {
    size: box.size || 9.3,
    color: C.ink,
  });
}

const notes = {
  0: [
    {
      x: 842, y: 330, w: 340, h: 126,
      lines: [
        "ER = Entity Relationship，实体关系",
        "README = 项目说明文件",
        "Group = 群组 / 服务器",
        "Go / Next.js / PostgreSQL = 技术栈名称，通常保留英文",
      ],
    },
  ],
  1: [
    {
      x: 950, y: 574, w: 270, h: 92,
      lines: [
        "PROJECT CONTEXT = 项目背景",
        "Group = 群组",
        "WebSocket = 实时长连接",
        "Kafka fanout = Kafka 事件广播分发",
      ],
    },
  ],
  2: [
    {
      x: 1050, y: 78, w: 176, h: 84,
      lines: [
        "ER OVERVIEW = ER 总览",
        "PK = 主键",
        "FK = 外键",
        "UK = 唯一键",
      ],
    },
    {
      x: 1058, y: 554, w: 168, h: 102,
      size: 8.7,
      lines: [
        "USERS = 用户表",
        "CHANNELS = 频道表",
        "MESSAGES = 消息表",
        "FRIENDSHIPS = 好友关系表",
        "DIRECT_CONVERSATIONS = 私信会话表",
      ],
    },
  ],
  3: [
    {
      x: 1046, y: 76, w: 180, h: 88,
      size: 8.8,
      lines: [
        "FULL ER DIAGRAM = 完整 ER 总图",
        "USERS = 用户表",
        "role = 角色",
        "online = 在线状态",
      ],
    },
    {
      x: 540, y: 334, w: 186, h: 102,
      size: 8.8,
      lines: [
        "owns = 拥有",
        "joins = 加入",
        "active = 活跃参与",
        "contains = 包含",
        "member = 成员",
        "pair_key = 用户对唯一标识",
      ],
    },
  ],
  4: [
    {
      x: 1012, y: 576, w: 214, h: 88,
      lines: [
        "CORE ENTITIES = 核心实体",
        "is_online = 是否在线",
        "content = 消息内容",
        "GORM = Go 常用 ORM 框架",
      ],
    },
  ],
  5: [
    {
      x: 980, y: 574, w: 246, h: 94,
      lines: [
        "RELATIONAL SCHEMA = 关系模式",
        "avatar = 头像",
        "avatar_url = 头像地址",
        "created_by = 创建者",
        "max_members = 最大成员数",
      ],
    },
  ],
  6: [
    {
      x: 944, y: 578, w: 282, h: 84,
      lines: [
        "GROUP + CHANNEL = 群组与频道",
        "type = 类型",
        "role = 角色",
        "is_default = 默认角色",
      ],
    },
  ],
  7: [
    {
      x: 944, y: 578, w: 282, h: 88,
      lines: [
        "MESSAGE FLOW = 消息流",
        "sends = 发送",
        "belongs to = 属于",
        "fanout = 广播分发",
      ],
    },
  ],
  8: [
    {
      x: 944, y: 570, w: 282, h: 96,
      lines: [
        "FRIENDS + DM = 好友与私信",
        "DM = Direct Message，私信",
        "pair_key = 会话双方唯一键",
        "status = 状态",
      ],
    },
  ],
  9: [
    {
      x: 1056, y: 78, w: 170, h: 82,
      lines: [
        "CONSTRAINTS = 约束",
        "PK = 主键",
        "FK = 外键",
        "UK = 唯一键",
      ],
    },
    {
      x: 996, y: 580, w: 230, h: 82,
      lines: [
        "deleted_at = 软删除时间",
        "id = 记录编号 / 主键编号",
        "User = 用户",
        "role = 角色",
      ],
    },
  ],
  10: [
    {
      x: 1048, y: 78, w: 178, h: 96,
      lines: [
        "SUMMARY = 总结",
        "User = 用户",
        "Group = 群组",
        "Message = 消息",
        "Relation = 关系",
        "Constraint = 约束",
      ],
    },
  ],
};

async function main() {
  await ensureArtifactToolWorkspace(workspace);
  const { FileBlob, PresentationFile } = await importArtifactTool(workspace);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(input));

  for (const [indexText, boxes] of Object.entries(notes)) {
    const slide = presentation.slides.getItem(Number(indexText));
    for (const box of boxes) addNote(slide, box);
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(output);
  console.log(JSON.stringify({ output, slideCount: presentation.slides.count }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
