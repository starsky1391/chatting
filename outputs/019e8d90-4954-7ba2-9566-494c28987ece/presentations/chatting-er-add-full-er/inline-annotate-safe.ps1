$ErrorActionPreference = "Stop"

$workspace = "C:\1Project\project_web\chatting\outputs\019e8d90-4954-7ba2-9566-494c28987ece\presentations\chatting-er-add-full-er"
$inputPptx = Join-Path $workspace "output\Chatting-ER图与关系模式讲解-含ER总图.pptx"
$outputPptx = Join-Path $workspace "output\Chatting-ER图与关系模式讲解-含ER总图-英文行内注释版.pptx"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

Copy-Item -LiteralPath $inputPptx -Destination $outputPptx -Force

$map = [ordered]@{
  "ER 图与关系模式讲解" = "ER（实体关系）图与关系模式讲解"
  "基于 README.md：Go + Next.js + PostgreSQL 的频道聊天、私信、好友、语音与后台管理系统。" = "基于 README.md（项目说明文件）：Go、Next.js、PostgreSQL（技术栈）的频道聊天、私信、好友、语音与后台管理系统。"
  "13 张主业务表" = "12 张主业务表"
  "用户、Group、频道、消息、好友、私信会话与权限角色。" = "用户、Group（群组）、频道、消息、好友、私信会话与权限角色。"
  "PROJECT CONTEXT" = "PROJECT CONTEXT（项目背景）"
  "Group 与频道" = "Group（群组）与频道"
  "频道消息和私信先落库，再由 WebSocket 推送，跨实例通过 Kafka fanout。" = "频道消息和私信先落库，再由 WebSocket（实时长连接）推送，跨实例通过 Kafka fanout（事件广播分发）。"
  "讲 ER 图时先分业务域，可以避免把表关系看成零散外键；每张表都对应一个稳定的产品概念或关系。" = "讲 ER（实体关系）图时先分业务域，可以避免把表关系看成零散外键；每张表都对应一个稳定的产品概念或关系。"

  "ER OVERVIEW" = "ER OVERVIEW（ER 总览）"
  "ER 总览可以拆成四个业务域，User 是所有关系的中心。" = "ER 总览可以拆成四个业务域，User（用户）是所有关系的中心。"
  "USERS" = "USERS（用户）"
  "id PK" = "id PK（主键）"
  "email UK" = "email（邮箱） UK（唯一键）"
  "username" = "username（用户名）"
  "role / online" = "role（角色） / online（在线）"
  "CHANNEL_GROUPS" = "CHANNEL_GROUPS（群组）"
  "owner_id FK" = "owner_id（拥有者） FK（外键）"
  "invite_code UK" = "invite_code（邀请码） UK（唯一键）"
  "CHANNELS" = "CHANNELS（频道）"
  "group_id FK" = "group_id（群组） FK（外键）"
  "type / position" = "type（类型） / position（排序）"
  "MESSAGES" = "MESSAGES（消息）"
  "sender_id FK" = "sender_id（发送者） FK（外键）"
  "channel_id FK" = "channel_id（频道） FK（外键）"
  "USER_GROUPS" = "USER_GROUPS（用户群组）"
  "user_id FK" = "user_id（用户） FK（外键）"
  "role" = "role（角色）"
  "USER_CHANNELS" = "USER_CHANNELS（用户频道）"
  "FRIEND_REQUESTS" = "FRIEND_REQUESTS（好友申请）"
  "requester_id FK" = "requester_id（申请人） FK（外键）"
  "addressee_id FK" = "addressee_id（接收人） FK（外键）"
  "status" = "status（状态）"
  "FRIENDSHIPS" = "FRIENDSHIPS（好友关系）"
  "friend_id FK" = "friend_id（好友） FK（外键）"
  "DIRECT_CONVERSATIONS" = "DIRECT_CONVERSATIONS（私信会话）"
  "pair_key UK" = "pair_key（会话唯一键） UK（唯一键）"
  "last_message_at" = "last_message_at（最后消息时间）"

  "FULL ER DIAGRAM" = "FULL ER DIAGRAM（完整 ER 总图）"
  "按业务域分区阅读：左侧是 Group/频道消息，右侧是好友与私信，中间 USERS 是全模型枢纽。" = "按业务域分区阅读：左侧是 Group（群组）/频道消息，右侧是好友与私信，中间 USERS（用户）是全模型枢纽。"
  "GROUP_ROLES" = "GROUP_ROLES（群组角色）"
  "name / position" = "name（名称） / position（排序）"
  "DIRECT_CONVERSATION_MEMBERS" = "DIRECT_CONVERSATION_MEMBERS（会话成员）"
  "direct_conversation_id FK" = "direct_conversation_id（会话） FK（外键）"
  "DIRECT_MESSAGES" = "DIRECT_MESSAGES（私信消息）"
  "conversation_id FK" = "conversation_id（会话） FK（外键）"
  "Group / 频道 / 消息域" = "Group（群组） / 频道 / 消息域"
  "owns" = "owns（拥有）"
  "joins" = "joins（加入）"
  "active" = "active（活跃）"
  "requests" = "requests（申请）"
  "friends" = "friends（好友）"
  "member" = "member（成员）"
  "contains" = "contains（包含）"
  "has" = "has（拥有）"
  "roles" = "roles（角色）"
  "pair_key" = "pair_key（会话唯一键）"
  "所有表默认包含 created_at / updated_at / deleted_at；deleted_at 支撑撤回、软删除和审计。" = "所有表默认包含 created_at（创建时间） / updated_at（更新时间） / deleted_at（删除时间）；deleted_at（删除时间）支撑撤回、软删除和审计。"

  "CORE ENTITIES" = "CORE ENTITIES（核心实体）"
  "id；email；role；is_online" = "id；email（邮箱）；role（角色）；is_online（在线）"
  "email 唯一" = "email（邮箱）唯一"
  "id；owner_id；invite_code" = "id；owner_id（拥有者）；invite_code（邀请码）"
  "invite_code 唯一" = "invite_code（邀请码）唯一"
  "id；group_id；type；position" = "id；group_id（群组）；type（类型）；position（排序）"
  "隶属于一个 Group" = "隶属于一个 Group（群组）"
  "id；sender_id；channel_id；content" = "id；sender_id（发送者）；channel_id（频道）；content（内容）"
  "id；group_id；name；position" = "id；group_id（群组）；name（名称）；position（排序）"
  "Group 内身份组和权限排序" = "Group（群组）内身份组和权限排序"
  "同一 Group 下定义角色" = "同一 Group（群组）下定义角色"
  "README 说明：带 gorm.Model 的表都包含 id、created_at、updated_at、deleted_at，其中 deleted_at 用于软删除。" = "README（项目说明）说明：带 gorm.Model（GORM 模型基类）的表都包含 id、created_at、updated_at、deleted_at，其中 deleted_at（删除时间）用于软删除。"

  "RELATIONAL SCHEMA" = "RELATIONAL SCHEMA（关系模式）"
  "(id, username, email, password, avatar, avatar_url, role, bio, last_seen, is_online, ...)" = "(id, username（用户名）, email（邮箱）, password（密码）, avatar（头像）, avatar_url（头像地址）, role（角色）, bio（简介）, last_seen（最后在线）, is_online（在线）, ...)"
  "PK: id；UK: email" = "PK（主键）: id；UK（唯一键）: email（邮箱）"
  "(id, name, description, icon, owner_id, invite_code, ...)" = "(id, name（名称）, description（描述）, icon（图标）, owner_id（拥有者）, invite_code（邀请码）, ...)"
  "PK: id；FK: owner_id；UK: invite_code" = "PK（主键）: id；FK（外键）: owner_id（拥有者）；UK（唯一键）: invite_code（邀请码）"
  "(id, name, type, description, group_id, position, created_by, max_members, ...)" = "(id, name（名称）, type（类型）, description（描述）, group_id（群组）, position（排序）, created_by（创建者）, max_members（人数上限）, ...)"
  "PK: id；FK: group_id" = "PK（主键）: id；FK（外键）: group_id（群组）"
  "(id, content, sender_id, channel_id, created_at, updated_at, deleted_at)" = "(id, content（内容）, sender_id（发送者）, channel_id（频道）, created_at（创建时间）, updated_at（更新时间）, deleted_at（删除时间）)"
  "PK: id；FK: sender_id, channel_id" = "PK（主键）: id；FK（外键）: sender_id（发送者）, channel_id（频道）"
  "(id, group_id, name, description, color, position, is_default, is_system, ...)" = "(id, group_id（群组）, name（名称）, description（描述）, color（颜色）, position（排序）, is_default（默认）, is_system（系统）, ...)"
  "这里的省略号表示 GORM 公共审计字段。讲解时重点不是背字段，而是说明每个外键把哪两个业务对象连起来。" = "这里的省略号表示 GORM（Go ORM 框架）公共审计字段。讲解时重点不是背字段，而是说明每个外键把哪两个业务对象连起来。"

  "GROUP + CHANNEL" = "GROUP + CHANNEL（群组与频道）"
  "Group 到频道是层级关系，用户加入 Group 后再进入具体频道。" = "Group（群组）到频道是层级关系，用户加入 Group（群组）后再进入具体频道。"
  "type" = "type（类型）"
  "name" = "name（名称）"
  "is_default" = "is_default（默认）"
  "USERS 与 CHANNEL_GROUPS 是多对多，因此拆成 USER_GROUPS；USERS 与 CHANNELS 的活跃状态也用 USER_CHANNELS 表达。" = "USERS（用户）与 CHANNEL_GROUPS（群组）是多对多，因此拆成 USER_GROUPS（用户群组）；USERS（用户）与 CHANNELS（频道）的活跃状态也用 USER_CHANNELS（用户频道）表达。"
  "一个用户可加入多个 Group/频道；一个 Group/频道也有多个用户，直接存数组会破坏关系模型。" = "一个用户可加入多个 Group（群组）/频道；一个 Group（群组）/频道也有多个用户，直接存数组会破坏关系模型。"
  "关系模式：USER_GROUPS(id, user_id, group_id, role, ...)，USER_CHANNELS(id, user_id, channel_id, ...)。" = "关系模式：USER_GROUPS（用户群组）(id, user_id, group_id, role, ...)，USER_CHANNELS（用户频道）(id, user_id, channel_id, ...)。"

  "MESSAGE FLOW" = "MESSAGE FLOW（消息流）"
  "avatar_url" = "avatar_url（头像地址）"
  "type=text" = "type=text（文本）"
  "sends" = "sends（发送）"
  "belongs to" = "belongs to（属于）"
  "写库后通过 WebSocket 推送；多实例下 Kafka/Redpanda 做事件 fanout。" = "写库后通过 WebSocket（实时长连接）推送；多实例下 Kafka/Redpanda（事件总线）做事件 fanout（广播分发）。"
  "撤回等场景依赖 deleted_at，前端刷新后不会再展示已撤回消息。" = "撤回等场景依赖 deleted_at（删除时间），前端刷新后不会再展示已撤回消息。"
  "频道消息关系模式：MESSAGES(id, content, sender_id, channel_id, created_at, updated_at, deleted_at)。" = "频道消息关系模式：MESSAGES（消息）(id, content（内容）, sender_id（发送者）, channel_id（频道）, created_at（创建时间）, updated_at（更新时间）, deleted_at（删除时间）)。"

  "FRIENDS + DM" = "FRIENDS + DM（好友与私信）"
  "FRIEND_REQUESTS 保存过程，FRIENDSHIPS 保存结果。" = "FRIEND_REQUESTS（好友申请）保存过程，FRIENDSHIPS（好友关系）保存结果。"
  "(id, requester_id, addressee_id, status, message, ...)" = "(id, requester_id（申请人）, addressee_id（接收人）, status（状态）, message（附言）, ...)"
  "(id, user_id, friend_id, ...)" = "(id, user_id（用户）, friend_id（好友）, ...)"
  "(id, pair_key, last_message_at, ...)" = "(id, pair_key（会话唯一键）, last_message_at（最后消息时间）, ...)"
  "两人私信会话，pair_key 唯一" = "两人私信会话，pair_key（会话唯一键）唯一"
  "(id, direct_conversation_id, user_id, ...)" = "(id, direct_conversation_id（会话）, user_id（用户）, ...)"
  "(id, conversation_id, sender_id, content, ...)" = "(id, conversation_id（会话）, sender_id（发送者）, content（内容）, ...)"
  "为什么会话要有 pair_key？" = "为什么会话要有 pair_key（会话唯一键）？"
  "同一对用户只能对应一个双人会话，避免 A-B 与 B-A 被创建成两条不同会话。" = "同一对用户只能对应一个双人会话，避免 A-B 与 B-A 被创建成两条不同会话。"
  "README 中还提到：系统允许非好友私信，同时用提示提醒关系状态，因此会话模型和好友模型必须解耦。" = "README（项目说明）中还提到：系统允许非好友私信，同时用提示提醒关系状态，因此会话模型和好友模型必须解耦。"

  "CONSTRAINTS" = "CONSTRAINTS（约束）"
  "主键 PK" = "主键 PK（主键）"
  "唯一 UK" = "唯一 UK（唯一键）"
  "外键 FK" = "外键 FK（外键）"
  "所有主业务表 id" = "所有主业务表 id（编号）"
  "USERS.email；CHANNEL_GROUPS.invite_code；DIRECT_CONVERSATIONS.pair_key" = "USERS（用户）.email（邮箱）；CHANNEL_GROUPS（群组）.invite_code（邀请码）；DIRECT_CONVERSATIONS（私信会话）.pair_key（会话唯一键）"
  "owner_id、group_id、sender_id、channel_id、conversation_id 等" = "owner_id（拥有者）、group_id（群组）、sender_id（发送者）、channel_id（频道）、conversation_id（会话）等"
  "USER_GROUPS、USER_CHANNELS、DIRECT_CONVERSATION_MEMBERS" = "USER_GROUPS（用户群组）、USER_CHANNELS（用户频道）、DIRECT_CONVERSATION_MEMBERS（会话成员）"
  "deleted_at" = "deleted_at（删除时间）"
  "范式角度：实体属性放在实体表，关系属性放在关系表；例如 User 在 Group 中的 role 属于 USER_GROUPS，而不是 USERS。" = "范式角度：实体属性放在实体表，关系属性放在关系表；例如 User（用户）在 Group（群组）中的 role（角色）属于 USER_GROUPS（用户群组），而不是 USERS（用户）。"

  "SUMMARY" = "SUMMARY（总结）"
  "1. User 是中心" = "1. User（用户）是中心"
  "拥有 Group、发送消息、加入频道、发起好友申请、参与私信会话。" = "拥有 Group（群组）、发送消息、加入频道、发起好友申请、参与私信会话。"
  "2. Group 是容器" = "2. Group（群组）是容器"
  "Group 包含频道、成员、身份组；频道承载文本或语音场景。" = "Group（群组）包含频道、成员、身份组；频道承载文本或语音场景。"
  "3. Message 是流水" = "3. Message（消息）是流水"
  "消息通过 sender_id 与 channel/conversation 关联，适合历史分页和实时同步。" = "消息通过 sender_id（发送者）与 channel/conversation（频道/会话）关联，适合历史分页和实时同步。"
  "4. Relation 用中间表" = "4. Relation（关系）用中间表"
  "5. Constraint 保证一致" = "5. Constraint（约束）保证一致"
  "PK、FK、UK、deleted_at 共同保证数据可定位、可引用、可恢复。" = "PK（主键）、FK（外键）、UK（唯一键）、deleted_at（删除时间）共同保证数据可定位、可引用、可恢复。"
}

$zip = [System.IO.Compression.ZipFile]::Open($outputPptx, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $slideEntryNames = @($zip.Entries | Where-Object { $_.FullName -match '^ppt/slides/slide\d+\.xml$' } | ForEach-Object { $_.FullName })
  foreach ($entryName in $slideEntryNames) {
    $entry = $zip.GetEntry($entryName)
    if (-not $entry) { continue }

    $reader = New-Object System.IO.StreamReader($entry.Open())
    try {
      $xml = $reader.ReadToEnd()
    } finally {
      $reader.Close()
    }

    $xml = [regex]::Replace($xml, '(?s)(<a:t>)([^<]*)(</a:t>)', {
      param($m)
      $prefix = $m.Groups[1].Value
      $text = $m.Groups[2].Value
      $suffix = $m.Groups[3].Value
      if ($map.Contains($text)) {
        return "$prefix$($map[$text])$suffix"
      }
      return $m.Value
    })

    $entry.Delete()
    $newEntry = $zip.CreateEntry($entryName)
    $writer = New-Object System.IO.StreamWriter($newEntry.Open())
    try {
      $writer.Write($xml)
    } finally {
      $writer.Close()
    }
  }
}
finally {
  $zip.Dispose()
}

Write-Output $outputPptx
