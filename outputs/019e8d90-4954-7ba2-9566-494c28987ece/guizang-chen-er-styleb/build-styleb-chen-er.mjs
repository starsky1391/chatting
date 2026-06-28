import fs from "node:fs/promises";
import path from "node:path";

const workspace = "C:/1Project/project_web/chatting/outputs/019e8d90-4954-7ba2-9566-494c28987ece/guizang-chen-er-styleb";
const templatePath = "C:/Users/COLORFUL/.codex/skills/guizang-ppt-skill/assets/template-swiss.html";
const outPath = path.join(workspace, "index.html");

const erCss = String.raw`

  /* ============ Chatting Chen ER · one-page Swiss diagram ============ */
  .er-page{
    flex:1;
    padding:0;
    display:grid;
    grid-template-rows:auto 1fr auto;
    gap:2.6vh;
    min-height:0;
  }
  .er-head{
    display:grid;
    grid-template-columns:minmax(0,1fr) 28vw;
    gap:3vw;
    align-items:end;
  }
  .er-head h1{
    font-family:var(--sans),var(--sans-zh);
    font-weight:200;
    font-size:min(4.8vw,8.4vh);
    line-height:1.02;
    letter-spacing:-.025em;
    color:var(--text-primary);
  }
  .er-head p{
    font-family:var(--sans),var(--sans-zh);
    font-weight:400;
    font-size:max(16px,1vw);
    line-height:1.55;
    color:var(--text-secondary);
  }
  .er-board{
    position:relative;
    min-height:0;
    border-top:2px solid var(--ink);
    border-bottom:1px solid var(--border-subtle);
    display:grid;
    grid-template-columns:14.5vw minmax(0,1fr);
    gap:2vw;
    padding-top:1.7vh;
    padding-bottom:1.2vh;
  }
  .er-rail{
    display:grid;
    grid-template-rows:auto auto 1fr;
    gap:1.4vh;
    border-right:1px solid var(--border-subtle);
    padding-right:1.4vw;
  }
  .er-rail .nb{
    font-family:var(--sans);
    font-weight:200;
    font-size:min(6.4vw,11vh);
    line-height:.86;
    letter-spacing:-.045em;
    color:var(--accent);
  }
  .er-rail .caption{
    font-family:var(--sans),var(--sans-zh);
    font-size:max(16px,.92vw);
    line-height:1.5;
    font-weight:400;
    color:var(--text-secondary);
  }
  .er-legend{
    align-self:end;
    display:grid;
    gap:1vh;
    font-family:var(--sans),var(--sans-zh);
    font-size:14px;
    line-height:1.35;
    font-weight:500;
    color:var(--text-helper);
  }
  .er-legend-row{display:flex;align-items:center;gap:.65vw}
  .er-mark{width:2.1vw;height:1.25vh;border:1.5px solid currentColor}
  .er-mark.rel{width:1.4vw;height:1.4vw;transform:rotate(45deg)}
  .er-mark.attr{border-radius:999px}
  .er-canvas{
    min-height:0;
    height:100%;
    display:grid;
    grid-template-columns:1fr 1fr;
    grid-template-rows:1fr 1fr;
    gap:1.6vh 1.6vw;
  }
  .er-mini{
    position:relative;
    border-top:1px solid var(--border-subtle);
    padding-top:1.2vh;
    display:grid;
    grid-template-rows:auto 1fr;
    min-height:0;
  }
  .er-mini-title{
    font-family:var(--mono);
    font-size:14px;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:var(--accent);
    font-weight:600;
    margin-bottom:.9vh;
  }
  .er-flow{
    display:grid;
    grid-auto-flow:column;
    grid-auto-columns:max-content;
    align-items:center;
    justify-content:center;
    gap:.75vw;
    min-height:0;
  }
  .er-flow.two-line{
    grid-auto-flow:row;
    grid-auto-rows:auto;
    justify-content:stretch;
    align-content:center;
    gap:2vh;
  }
  .er-flow-line{
    display:grid;
    grid-auto-flow:column;
    grid-auto-columns:max-content;
    align-items:center;
    justify-content:center;
    gap:.75vw;
  }
  .er-wrap{
    display:grid;
    place-items:center;
    gap:.45vh;
  }
  .er-attr-line{
    width:1px;
    height:.7vh;
    background:var(--border-strong);
  }
  .er-link{
    width:2.2vw;
    height:2px;
    background:var(--ink);
  }
  .er-link.accent{background:var(--accent)}
  .er-node{
    display:grid;
    place-items:center;
    text-align:center;
    font-family:var(--sans),var(--sans-zh);
    color:var(--text-primary);
    background:var(--paper);
    border:2px solid var(--ink);
    min-width:6.7vw;
    min-height:4.2vh;
    padding:.5vh .75vw;
    font-size:max(16px,.98vw);
    line-height:1.12;
    font-weight:600;
    z-index:2;
  }
  .er-node.entity{border-color:var(--ink)}
  .er-node.rel{
    width:4vw;
    height:4vw;
    min-width:4vw;
    min-height:4vw;
    transform:rotate(45deg);
    border-color:var(--accent);
    color:var(--accent);
    background:var(--paper);
  }
  .er-node.rel > span{
    transform:rotate(-45deg);
    font-size:max(13px,.68vw);
    font-weight:700;
    line-height:1.08;
    white-space:pre-line;
  }
  .er-node.attr{
    min-width:5.4vw;
    min-height:2.5vh;
    border-width:1.5px;
    border-radius:999px;
    color:var(--text-secondary);
    font-size:max(14px,.78vw);
    font-weight:500;
    padding:.35vh .7vw;
  }
  .er-node.dim{
    border-color:var(--border-strong);
    color:var(--text-secondary);
  }
  .er-note{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:2vw;
    font-family:var(--sans),var(--sans-zh);
    font-size:max(16px,.9vw);
    line-height:1.45;
    font-weight:400;
    color:var(--text-secondary);
  }
  .er-note strong{
    display:block;
    font-family:var(--mono);
    font-size:14px;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:var(--accent);
    margin-bottom:.5vh;
  }
`;

const slide = String.raw`
<section class="slide light" data-layout="S17" data-animate="system-diagram">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">Chatting · Database Model</div>
      <div class="r">Chen ER · Style B · 01 / 01</div>
    </div>

    <div class="er-page">
      <div data-anim="head" class="er-head">
        <div style="display:flex;flex-direction:column;gap:1.2vh">
          <div class="t-meta" style="color:var(--accent);letter-spacing:.2em">CHEN ER DIAGRAM / CORE DOMAIN</div>
          <h1>Chatting 核心业务陈氏 ER 图</h1>
        </div>
        <p>根据 README 的 GORM 表关系抽象：矩形是实体，菱形是联系，椭圆是关键属性。为保证讲解清楚，这页只保留群组、频道消息、好友私信三条主链。</p>
      </div>

      <div data-anim="diagram" class="er-board">
        <aside class="er-rail">
          <div class="nb">ER</div>
          <div class="caption">把中间表还原为业务联系：USER_GROUPS 是“加入”，FRIENDSHIPS 是“好友”，DIRECT_CONVERSATION_MEMBERS 是“参与”。</div>
          <div class="er-legend">
            <div class="er-legend-row"><span class="er-mark"></span><span>实体 Entity</span></div>
            <div class="er-legend-row"><span class="er-mark rel"></span><span>联系 Relationship</span></div>
            <div class="er-legend-row"><span class="er-mark attr"></span><span>属性 Attribute</span></div>
          </div>
        </aside>

        <div class="er-canvas">
          <div class="er-mini">
            <div class="er-mini-title">01 / Group Membership</div>
            <div class="er-flow">
              <div class="er-wrap">
                <div class="er-node attr">用户名</div>
                <div class="er-attr-line"></div>
                <div class="er-node entity">用户</div>
              </div>
              <div class="er-link accent"></div>
              <div class="er-node rel"><span>加入<br>N:M</span></div>
              <div class="er-link accent"></div>
              <div class="er-wrap">
                <div class="er-node entity">群组</div>
                <div class="er-attr-line"></div>
                <div class="er-node attr">邀请码</div>
              </div>
            </div>
          </div>

          <div class="er-mini">
            <div class="er-mini-title">02 / Group Structure</div>
            <div class="er-flow two-line">
              <div class="er-flow-line">
                <div class="er-node entity">群组</div>
                <div class="er-link"></div>
                <div class="er-node rel"><span>包含<br>1:N</span></div>
                <div class="er-link"></div>
                <div class="er-wrap">
                  <div class="er-node attr">类型</div>
                  <div class="er-attr-line"></div>
                  <div class="er-node entity">频道</div>
                </div>
              </div>
              <div class="er-flow-line">
                <div class="er-node entity">群组</div>
                <div class="er-link"></div>
                <div class="er-node rel"><span>定义<br>1:N</span></div>
                <div class="er-link"></div>
                <div class="er-wrap">
                  <div class="er-node entity dim">角色组</div>
                  <div class="er-attr-line"></div>
                  <div class="er-node attr">名称</div>
                </div>
              </div>
            </div>
          </div>

          <div class="er-mini">
            <div class="er-mini-title">03 / Channel Messages</div>
            <div class="er-flow two-line">
              <div class="er-flow-line">
                <div class="er-node entity">用户</div>
                <div class="er-link"></div>
                <div class="er-node rel"><span>发送<br>1:N</span></div>
                <div class="er-link"></div>
                <div class="er-wrap">
                  <div class="er-node entity">频道消息</div>
                  <div class="er-attr-line"></div>
                  <div class="er-node attr">内容 / 时间</div>
                </div>
              </div>
              <div class="er-flow-line">
                <div class="er-node entity">频道消息</div>
                <div class="er-link"></div>
                <div class="er-node rel"><span>属于<br>N:1</span></div>
                <div class="er-link"></div>
                <div class="er-node entity">频道</div>
              </div>
            </div>
          </div>

          <div class="er-mini">
            <div class="er-mini-title">04 / Friend & Direct Message</div>
            <div class="er-flow two-line">
              <div class="er-flow-line">
                <div class="er-node entity">用户A</div>
                <div class="er-link"></div>
                <div class="er-wrap">
                  <div class="er-node attr">状态</div>
                  <div class="er-attr-line"></div>
                  <div class="er-node rel"><span>好友<br>1:1</span></div>
                </div>
                <div class="er-link"></div>
                <div class="er-node entity">用户B</div>
              </div>
              <div class="er-flow-line">
                <div class="er-node entity">用户</div>
                <div class="er-link accent"></div>
                <div class="er-node rel"><span>参与<br>N:M</span></div>
                <div class="er-link accent"></div>
                <div class="er-wrap">
                  <div class="er-node entity">私信会话</div>
                  <div class="er-attr-line"></div>
                  <div class="er-node attr">会话键</div>
                </div>
                <div class="er-link"></div>
                <div class="er-node rel"><span>包含<br>1:N</span></div>
                <div class="er-link"></div>
                <div class="er-wrap">
                  <div class="er-node entity">私信消息</div>
                  <div class="er-attr-line"></div>
                  <div class="er-node attr">内容</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div data-anim="foot" class="er-note">
        <div><strong>Reading 01</strong>群组链路从“用户拥有群组”展开，再进入频道与频道消息。</div>
        <div><strong>Reading 02</strong>角色组、语音频道被放成辅助实体，避免主图连线过密。</div>
        <div><strong>Reading 03</strong>私信链路拆成好友关系与会话消息关系，讲解时按上下两层阅读。</div>
      </div>
    </div>
  </div>
</section>
`;

await fs.mkdir(workspace, { recursive: true });
let html = await fs.readFile(templatePath, "utf8");
html = html.replace("[必填] 替换为 PPT 标题 · Deck Title", "Chatting 陈氏 ER 图 · Style B");
html = html.replace("</style>", `${erCss}\n</style>`);
html = html.replace(/<!-- SLIDES_HERE[\s\S]*?(?=<\/div>\s*<div id="nav">)/, `${slide}\n`);
if (html.includes("[必填]")) {
  throw new Error("Template placeholders remain in generated HTML.");
}
await fs.writeFile(outPath, html, "utf8");
console.log(JSON.stringify({ outPath }, null, 2));
