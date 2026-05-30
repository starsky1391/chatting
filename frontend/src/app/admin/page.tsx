"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, LogOut, MessageSquare, RefreshCw, Search, Server, Shield, Trash2, UserCog, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredToken, getStoredUser, useChatStore } from '@/store/useChatStore';

type Role = 'admin' | 'moderator' | 'member';

type StoredUser = {
  id: number;
  username: string;
  email: string;
  role: Role;
};

type Summary = {
  users: number;
  onlineUsers: number;
  groups: number;
  channels: number;
  messages: number;
  directConversations: number;
  directMessages: number;
  pendingFriendRequests: number;
};

type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: Role;
  isOnline: boolean;
  lastSeen?: string | null;
  createdAt: string;
};

type AdminGroup = {
  id: number;
  name: string;
  description: string;
  ownerId: number;
  ownerName: string;
  inviteCode: string;
  channels: number;
  members: number;
  createdAt: string;
};

type AdminMessage = {
  id: number;
  content: string;
  senderId: number;
  senderName: string;
  channelId: number;
  channelName: string;
  createdAt: string;
};

type AdminDirectMessage = {
  id: number;
  content: string;
  senderId: number;
  senderName: string;
  conversationId: number;
  memberNames?: string[];
  createdAt: string;
};

type Tab = 'users' | 'groups' | 'messages' | 'directMessages';

type TabMeta = {
  label: string;
  description: string;
  searchPlaceholder: string;
};

const TAB_META: Record<Tab, TabMeta> = {
  users: {
    label: '用户',
    description: '管理账号、角色和在线状态',
    searchPlaceholder: '搜索用户名、邮箱或角色',
  },
  groups: {
    label: '群组',
    description: '查看群组拥有者、邀请码和规模',
    searchPlaceholder: '搜索群组、拥有者或邀请码',
  },
  messages: {
    label: '频道消息',
    description: '审查频道内消息内容',
    searchPlaceholder: '搜索内容、发送者或频道',
  },
  directMessages: {
    label: '私信消息',
    description: '审查一对一私信内容',
    searchPlaceholder: '搜索内容、发送者或会话 ID',
  },
};

async function adminRequest<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  return api.request<T>(endpoint, init);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function truncate(value: string, length = 80) {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
}

function includesQuery(values: Array<string | number | boolean | null | undefined>, query: string) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return values.some((value) => String(value ?? '').toLowerCase().includes(normalized));
}

export default function AdminPage() {
  const router = useRouter();
  const logout = useChatStore((state) => state.logout);
  const [adminUser] = useState<StoredUser | null>(() => (typeof window === 'undefined' ? null : getStoredUser()));
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<AdminDirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryData, userRows, groupRows, messageRows, directMessageRows] = await Promise.all([
        adminRequest<Summary>('/api/admin/summary'),
        adminRequest<AdminUser[]>('/api/admin/users?limit=100'),
        adminRequest<AdminGroup[]>('/api/admin/groups?limit=100'),
        adminRequest<AdminMessage[]>('/api/admin/messages?limit=100'),
        adminRequest<AdminDirectMessage[]>('/api/admin/direct-messages?limit=100'),
      ]);
      setSummary(summaryData);
      setUsers(Array.isArray(userRows) ? userRows : []);
      setGroups(Array.isArray(groupRows) ? groupRows : []);
      setMessages(Array.isArray(messageRows) ? messageRows : []);
      setDirectMessages(Array.isArray(directMessageRows) ? directMessageRows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!getStoredToken()) {
      router.replace('/login?redirect=/admin');
      return;
    }
    if (!user || user.role !== 'admin') {
      router.replace(user?.id ? `/${user.id}` : '/login');
      return;
    }

    void loadAdminData();
  }, [loadAdminData, router]);

  const stats = useMemo(() => {
    if (!summary) return [];
    return [
      { label: '用户', value: summary.users, icon: Users },
      { label: '在线', value: summary.onlineUsers, icon: BarChart3 },
      { label: '群组', value: summary.groups, icon: Server },
      { label: '频道', value: summary.channels, icon: MessageSquare },
      { label: '频道消息', value: summary.messages, icon: MessageSquare },
      { label: '私信会话', value: summary.directConversations, icon: UserCog },
      { label: '私信消息', value: summary.directMessages, icon: MessageSquare },
      { label: '好友申请', value: summary.pendingFriendRequests, icon: Users },
    ];
  }, [summary]);

  const filteredUsers = useMemo(() => (
    users.filter((user) => includesQuery([user.username, user.email, user.role, user.isOnline ? '在线' : '离线'], query))
  ), [query, users]);

  const filteredGroups = useMemo(() => (
    groups.filter((group) => includesQuery([group.name, group.description, group.ownerName, group.ownerId, group.inviteCode], query))
  ), [groups, query]);

  const filteredMessages = useMemo(() => (
    messages.filter((message) => includesQuery([message.content, message.senderName, message.senderId, message.channelName, message.channelId], query))
  ), [messages, query]);

  const filteredDirectMessages = useMemo(() => (
    directMessages.filter((message) => includesQuery([message.content, message.senderName, message.senderId, message.conversationId, ...(message.memberNames || [])], query))
  ), [directMessages, query]);

  const activeCount = useMemo(() => {
    switch (activeTab) {
      case 'users':
        return filteredUsers.length;
      case 'groups':
        return filteredGroups.length;
      case 'messages':
        return filteredMessages.length;
      case 'directMessages':
        return filteredDirectMessages.length;
    }
  }, [activeTab, filteredDirectMessages.length, filteredGroups.length, filteredMessages.length, filteredUsers.length]);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setQuery('');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const updateRole = async (userID: number, role: Role) => {
    await adminRequest<null>(`/api/admin/users/${userID}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
    await loadAdminData();
  };

  const removeUser = async (userID: number) => {
    if (!window.confirm('确定删除这个用户吗？')) return;
    await adminRequest<null>(`/api/admin/users/${userID}`, { method: 'DELETE' });
    await loadAdminData();
  };

  const removeGroup = async (groupID: number) => {
    if (!window.confirm('确定删除这个群组及其频道吗？')) return;
    await adminRequest<null>(`/api/admin/groups/${groupID}`, { method: 'DELETE' });
    await loadAdminData();
  };

  const removeMessage = async (messageID: number) => {
    if (!window.confirm('确定删除这条频道消息吗？')) return;
    await adminRequest<null>(`/api/admin/messages/${messageID}`, { method: 'DELETE' });
    await loadAdminData();
  };

  const removeDirectMessage = async (messageID: number) => {
    if (!window.confirm('确定删除这条私信消息吗？')) return;
    await adminRequest<null>(`/api/admin/direct-messages/${messageID}`, { method: 'DELETE' });
    await loadAdminData();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0f0f12] text-zinc-100">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 bg-[#151517] px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">管理后台</h1>
            <p className="text-xs text-zinc-500">{adminUser?.email || 'admin'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadAdminData()}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4" />
            退出
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-6 py-5">
        {error && (
          <div className="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-lg border border-zinc-800 bg-[#151517] px-3 py-3">
                <div className="mb-2 flex items-center justify-between text-zinc-500">
                  <span className="text-xs">{stat.label}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-xl font-semibold text-white">{stat.value}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-[#151517]">
          <div className="shrink-0 border-b border-zinc-800 px-4 pt-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-white">{TAB_META[activeTab].label}</h2>
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
                    {activeCount} 条
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{TAB_META[activeTab].description}</p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 xl:w-80 xl:flex-none">
                  <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={TAB_META[activeTab].searchPlaceholder}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </label>
                <button
                  onClick={() => void loadAdminData()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新
                </button>
              </div>
            </div>

            <nav className="mt-4 flex gap-1 overflow-x-auto">
              <TabButton active={activeTab === 'users'} onClick={() => switchTab('users')} label="用户" count={users.length} />
              <TabButton active={activeTab === 'groups'} onClick={() => switchTab('groups')} label="群组" count={groups.length} />
              <TabButton active={activeTab === 'messages'} onClick={() => switchTab('messages')} label="频道消息" count={messages.length} />
              <TabButton active={activeTab === 'directMessages'} onClick={() => switchTab('directMessages')} label="私信消息" count={directMessages.length} />
            </nav>
          </div>

          <div className="min-h-0 flex-1">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">加载中...</div>
          ) : (
            <>
              {activeTab === 'users' && <UsersTable rows={filteredUsers} onRoleChange={updateRole} onDelete={removeUser} currentUserID={adminUser?.id || 0} />}
              {activeTab === 'groups' && <GroupsTable rows={filteredGroups} onDelete={removeGroup} />}
              {activeTab === 'messages' && <MessagesTable rows={filteredMessages} onDelete={removeMessage} />}
              {activeTab === 'directMessages' && <DirectMessagesTable rows={filteredDirectMessages} onDelete={removeDirectMessage} />}
            </>
          )}
          </div>
        </section>
      </main>
    </div>
  );
}

function TabButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm ${active ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${active ? 'bg-indigo-500/20 text-indigo-200' : 'bg-zinc-800 text-zinc-500'}`}>
        {count}
      </span>
    </button>
  );
}

function UsersTable({
  rows,
  onRoleChange,
  onDelete,
  currentUserID,
}: {
  rows: AdminUser[];
  onRoleChange: (userID: number, role: Role) => Promise<void>;
  onDelete: (userID: number) => Promise<void>;
  currentUserID: number;
}) {
  return (
    <TableShell headers={['用户', '邮箱', '角色', '状态', '注册时间', '操作']} empty={rows.length === 0}>
      {rows.map((user) => (
        <tr key={user.id} className="border-t border-zinc-800 hover:bg-zinc-900/40">
          <td className="w-[20%] px-4 py-3 text-sm text-white">
            <div className="font-medium">{user.username}</div>
            <div className="text-xs text-zinc-600">ID {user.id}</div>
          </td>
          <td className="w-[24%] px-4 py-3 text-sm text-zinc-400">{user.email}</td>
          <td className="w-[16%] px-4 py-3">
            <select
              value={user.role}
              onChange={(event) => void onRoleChange(user.id, event.target.value as Role)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
            >
              <option value="admin">admin</option>
              <option value="moderator">moderator</option>
              <option value="member">member</option>
            </select>
          </td>
          <td className="px-4 py-3 text-sm">
            <span className={user.isOnline ? 'text-green-400' : 'text-zinc-500'}>{user.isOnline ? '在线' : '离线'}</span>
          </td>
          <td className="w-[20%] px-4 py-3 text-sm text-zinc-500">{formatDate(user.createdAt)}</td>
          <td className="w-[88px] px-4 py-3 text-right">
            <DeleteButton disabled={user.id === currentUserID} onClick={() => void onDelete(user.id)} />
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function GroupsTable({ rows, onDelete }: { rows: AdminGroup[]; onDelete: (groupID: number) => Promise<void> }) {
  return (
    <TableShell headers={['群组', '拥有者', '邀请码', '频道', '成员', '创建时间', '操作']} empty={rows.length === 0}>
      {rows.map((group) => (
        <tr key={group.id} className="border-t border-zinc-800 hover:bg-zinc-900/40">
          <td className="w-[30%] px-4 py-3">
            <p className="text-sm font-medium text-white">{group.name}</p>
            <p className="mt-1 max-h-9 overflow-hidden text-xs leading-4 text-zinc-500">{group.description || '-'}</p>
          </td>
          <td className="w-[16%] px-4 py-3 text-sm text-zinc-400">{group.ownerName || group.ownerId}</td>
          <td className="w-[18%] px-4 py-3 text-sm text-zinc-500">
            <code className="rounded bg-zinc-950 px-2 py-1 text-xs text-indigo-300">{group.inviteCode}</code>
          </td>
          <td className="px-4 py-3 text-sm text-zinc-400">{group.channels}</td>
          <td className="px-4 py-3 text-sm text-zinc-400">{group.members}</td>
          <td className="w-[18%] px-4 py-3 text-sm text-zinc-500">{formatDate(group.createdAt)}</td>
          <td className="w-[88px] px-4 py-3 text-right">
            <DeleteButton onClick={() => void onDelete(group.id)} />
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function DirectMessagesTable({ rows, onDelete }: { rows: AdminDirectMessage[]; onDelete: (messageID: number) => Promise<void> }) {
  return (
    <MessageGroupShell
      empty={rows.length === 0}
      groups={groupDirectMessages(rows)}
      renderHeader={(group) => (
        <>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium text-white">{group.title}</p>
              <span className="shrink-0 rounded bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-400">#{group.conversationId}</span>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">最新：{group.latestSender} · {formatDate(group.latestAt)}</p>
          </div>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">{group.messages.length} 条</span>
        </>
      )}
      renderBody={(group) => (
        <CompactMessagesTable
          headers={['内容', '发送者', '时间', '操作']}
          rows={group.messages.map((message) => ({
            id: message.id,
            content: message.content,
            sender: message.senderName || String(message.senderId),
            createdAt: message.createdAt,
          }))}
          onDelete={onDelete}
        />
      )}
    />
  );
}

type ChannelMessageGroup = {
  id: string;
  channelId: number;
  title: string;
  latestAt: string;
  latestSender: string;
  messages: AdminMessage[];
};

type DirectMessageGroup = {
  id: string;
  conversationId: number;
  title: string;
  latestAt: string;
  latestSender: string;
  messages: AdminDirectMessage[];
};

function MessagesTable({ rows, onDelete }: { rows: AdminMessage[]; onDelete: (messageID: number) => Promise<void> }) {
  return (
    <MessageGroupShell
      empty={rows.length === 0}
      groups={groupChannelMessages(rows)}
      renderHeader={(group) => (
        <>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium text-white">{group.title}</p>
              <span className="shrink-0 rounded bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-400">频道 ID {group.channelId}</span>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">最新：{group.latestSender} · {formatDate(group.latestAt)}</p>
          </div>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">{group.messages.length} 条</span>
        </>
      )}
      renderBody={(group) => (
        <CompactMessagesTable
          headers={['内容', '发送者', '时间', '操作']}
          rows={group.messages.map((message) => ({
            id: message.id,
            content: message.content,
            sender: message.senderName || String(message.senderId),
            createdAt: message.createdAt,
          }))}
          onDelete={onDelete}
        />
      )}
    />
  );
}

function groupChannelMessages(rows: AdminMessage[]): ChannelMessageGroup[] {
  const groups = new Map<number, ChannelMessageGroup>();
  rows.forEach((message) => {
    const existing = groups.get(message.channelId);
    if (existing) {
      existing.messages.push(message);
      if (new Date(message.createdAt).getTime() > new Date(existing.latestAt).getTime()) {
        existing.latestAt = message.createdAt;
        existing.latestSender = message.senderName || String(message.senderId);
      }
      return;
    }

    groups.set(message.channelId, {
      id: `channel-${message.channelId}`,
      channelId: message.channelId,
      title: message.channelName || `频道 ${message.channelId}`,
      latestAt: message.createdAt,
      latestSender: message.senderName || String(message.senderId),
      messages: [message],
    });
  });
  return Array.from(groups.values()).sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

function groupDirectMessages(rows: AdminDirectMessage[]): DirectMessageGroup[] {
  const groups = new Map<number, DirectMessageGroup>();
  rows.forEach((message) => {
    const existing = groups.get(message.conversationId);
    if (existing) {
      existing.messages.push(message);
      if (new Date(message.createdAt).getTime() > new Date(existing.latestAt).getTime()) {
        existing.latestAt = message.createdAt;
        existing.latestSender = message.senderName || String(message.senderId);
      }
      return;
    }

    const names = (message.memberNames || []).filter(Boolean);
    groups.set(message.conversationId, {
      id: `direct-${message.conversationId}`,
      conversationId: message.conversationId,
      title: names.length > 0 ? names.join(' / ') : `私信会话 ${message.conversationId}`,
      latestAt: message.createdAt,
      latestSender: message.senderName || String(message.senderId),
      messages: [message],
    });
  });
  return Array.from(groups.values()).sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

function MessageGroupShell<T extends { id: string; messages: unknown[] }>({
  empty,
  groups,
  renderHeader,
  renderBody,
}: {
  empty: boolean;
  groups: T[];
  renderHeader: (group: T) => React.ReactNode;
  renderBody: (group: T) => React.ReactNode;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  if (empty) {
    return <div className="px-4 py-16 text-center text-sm text-zinc-500">没有符合条件的数据</div>;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="divide-y divide-zinc-800">
        {groups.map((group) => {
          const expanded = openGroups[group.id] || false;
          const Icon = expanded ? ChevronDown : ChevronRight;
          return (
            <section key={group.id} className="bg-[#151517]">
              <button
                type="button"
                onClick={() => setOpenGroups((items) => ({ ...items, [group.id]: !expanded }))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900/50"
              >
                <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                {renderHeader(group)}
              </button>
              {expanded && <div className="border-t border-zinc-800 bg-[#101013]">{renderBody(group)}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CompactMessagesTable({
  headers,
  rows,
  onDelete,
}: {
  headers: string[];
  rows: Array<{ id: number; content: string; sender: string; createdAt: string }>;
  onDelete: (messageID: number) => Promise<void>;
}) {
  return (
    <table className="w-full min-w-[760px] table-fixed">
      <thead className="bg-zinc-950/60">
        <tr className="text-left text-xs uppercase text-zinc-500">
          {headers.map((header) => (
            <th key={header} className="px-4 py-2 font-medium">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((message) => (
          <tr key={message.id} className="border-t border-zinc-800 align-top hover:bg-zinc-900/50">
            <td className="w-[54%] px-4 py-3 text-sm text-zinc-200">
              <MessagePreview content={message.content} />
            </td>
            <td className="w-[18%] px-4 py-3 text-sm text-zinc-400">{message.sender}</td>
            <td className="w-[20%] px-4 py-3 text-sm text-zinc-500">{formatDate(message.createdAt)}</td>
            <td className="w-[88px] px-4 py-3 text-right">
              <DeleteButton onClick={() => void onDelete(message.id)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MessagePreview({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const shouldToggle = content.length > 96;

  return (
    <div className="max-w-full">
      <p className={`${expanded ? 'whitespace-pre-wrap' : 'max-h-10 overflow-hidden'} break-words leading-5`}>
        {expanded ? content : truncate(content, 120)}
      </p>
      {shouldToggle && (
        <button
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs text-indigo-300 hover:text-indigo-200"
        >
          {expanded ? '收起' : '展开'}
        </button>
      )}
    </div>
  );
}

function TableShell({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full min-w-[900px] table-fixed">
        <thead className="sticky top-0 z-10 bg-[#151517]">
          <tr className="border-b border-zinc-800 text-left text-xs uppercase text-zinc-500">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-16 text-center text-sm text-zinc-500">
                没有符合条件的数据
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function DeleteButton({ disabled = false, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
      title="删除"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
