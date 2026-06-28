$ErrorActionPreference = "Stop"

$workspace = "C:\1Project\project_web\chatting\outputs\019e8d90-4954-7ba2-9566-494c28987ece\presentations\chatting-er-add-full-er"
$inputPptx = Join-Path $workspace "output\Chatting-ER图与关系模式讲解-含ER总图.pptx"
$outputPptx = Join-Path $workspace "output\Chatting-ER图与关系模式讲解-含ER总图-英文行内注释版.pptx"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

Copy-Item -LiteralPath $inputPptx -Destination $outputPptx -Force

$zip = [System.IO.Compression.ZipFile]::Open($outputPptx, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $replacements = [ordered]@{
    "13 张主业务表" = "12 张主业务表"

    "ER 图与关系模式讲解" = "ER（实体关系）图与关系模式讲解"
    "README.md" = "README.md（项目说明文件）"
    "Go + Next.js + PostgreSQL" = "Go + Next.js + PostgreSQL（技术栈）"
    "Group" = "Group（群组）"
    ">ER<" = ">ER（实体关系）<"

    "PROJECT CONTEXT" = "PROJECT CONTEXT（项目背景）"
    "WebSocket" = "WebSocket（实时长连接）"
    "Kafka fanout" = "Kafka fanout（Kafka 广播分发）"

    "ER OVERVIEW" = "ER OVERVIEW（ER 总览）"
    "User 是所有关系的中心。" = "User（用户）是所有关系的中心。"
    "USERS" = "USERS（用户表）"
    "CHANNEL_GROUPS" = "CHANNEL_GROUPS（群组表）"
    "CHANNELS" = "CHANNELS（频道表）"
    "MESSAGES" = "MESSAGES（消息表）"
    "USER_GROUPS" = "USER_GROUPS（用户-群组关系表）"
    "USER_CHANNELS" = "USER_CHANNELS（用户-频道关系表）"
    "FRIEND_REQUESTS" = "FRIEND_REQUESTS（好友申请表）"
    "FRIENDSHIPS" = "FRIENDSHIPS（好友关系表）"
    "DIRECT_CONVERSATIONS" = "DIRECT_CONVERSATIONS（私信会话表）"
    "DIRECT_CONVERSATION_MEMBERS" = "DIRECT_CONVERSATION_MEMBERS（会话成员表）"
    "DIRECT_MESSAGES" = "DIRECT_MESSAGES（私信消息表）"
    "PK" = "PK（主键）"
    "FK" = "FK（外键）"
    "UK" = "UK（唯一键）"
    "role / online" = "role（角色） / online（在线状态）"
    "type / position" = "type（类型） / position（排序）"
    "status" = "status（状态）"
    "pair_key" = "pair_key（用户对唯一键）"
    "last_message_at" = "last_message_at（最后消息时间）"
    "requester_id" = "requester_id（申请人）"
    "addressee_id" = "addressee_id（被申请人）"
    "friend_id" = "friend_id（好友用户）"
    "conversation_id" = "conversation_id（会话编号）"
    "sender_id" = "sender_id（发送者）"
    "channel_id" = "channel_id（频道编号）"
    "group_id" = "group_id（群组编号）"
    "owner_id" = "owner_id（拥有者）"
    "invite_code" = "invite_code（邀请码）"
    "username" = "username（用户名）"
    "email" = "email（邮箱）"

    "FULL ER DIAGRAM" = "FULL ER DIAGRAM（完整 ER 总图）"
    "中间 USERS 是全模型枢纽。" = "中间 USERS（用户表）是全模型枢纽。"
    "owns" = "owns（拥有）"
    "joins" = "joins（加入）"
    "active" = "active（活跃参与）"
    "requests" = "requests（发起申请）"
    "friends" = "friends（好友关系）"
    "member" = "member（成员）"
    "contains" = "contains（包含）"
    "has" = "has（拥有）"
    "roles" = "roles（角色）"

    "CORE ENTITIES" = "CORE ENTITIES（核心实体）"
    "is_online" = "is_online（是否在线）"
    "content" = "content（内容）"
    "gorm.Model" = "gorm.Model（GORM 模型基类）"
    "deleted_at" = "deleted_at（软删除时间）"

    "RELATIONAL SCHEMA" = "RELATIONAL SCHEMA（关系模式）"
    "password" = "password（密码）"
    "avatar" = "avatar（头像）"
    "avatar_url" = "avatar_url（头像地址）"
    "bio" = "bio（简介）"
    "last_seen" = "last_seen（最后在线时间）"
    "description" = "description（描述）"
    "icon" = "icon（图标）"
    "created_by" = "created_by（创建者）"
    "max_members" = "max_members（最大成员数）"
    "color" = "color（颜色）"
    "is_default" = "is_default（默认角色）"
    "is_system" = "is_system（系统角色）"
    "GORM" = "GORM（Go ORM 框架）"

    "GROUP + CHANNEL" = "GROUP + CHANNEL（群组与频道）"
    "type=text" = "type=text（文本频道）"

    "MESSAGE FLOW" = "MESSAGE FLOW（消息流）"
    "sends" = "sends（发送）"
    "belongs to" = "belongs to（属于）"
    "Kafka/Redpanda" = "Kafka/Redpanda（消息事件总线）"

    "FRIENDS + DM" = "FRIENDS + DM（好友与私信）"
    "DM" = "DM（私信）"
    "message" = "message（申请附言）"

    "CONSTRAINTS" = "CONSTRAINTS（约束）"
    "User（用户） 在 Group（群组） 中的 role（角色）" = "User（用户）在 Group（群组）中的 role（角色）"

    "SUMMARY" = "SUMMARY（总结）"
    "1. User 是中心" = "1. User（用户）是中心"
    "2. Group 是容器" = "2. Group（群组）是容器"
    "3. Message 是流水" = "3. Message（消息）是流水"
    "4. Relation 用中间表" = "4. Relation（关系）用中间表"
    "5. Constraint 保证一致" = "5. Constraint（约束）保证一致"
    "channel/conversation" = "channel/conversation（频道/会话）"
  }

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

    foreach ($pair in $replacements.GetEnumerator()) {
      $xml = $xml.Replace($pair.Key, $pair.Value)
    }

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
