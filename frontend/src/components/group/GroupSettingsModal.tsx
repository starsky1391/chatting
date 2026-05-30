"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Bot, ImageIcon, Loader2, Plus, Save, Shield, Trash2, Upload, Users, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { config } from '@/lib/config';
import { getMemberRoleName, roleLabel, sortMembersByRole } from '@/lib/roles';

interface ChannelGroup {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  ownerId: number;
}

interface GroupRole {
  id: number;
  groupId: number;
  name: string;
  description: string;
  color: string;
  position: number;
  isDefault: boolean;
  isSystem: boolean;
}

interface GroupMember {
  id: number;
  username: string;
  avatar?: string;
  avatarUrl?: string;
  isOnline: boolean;
  role: string;
  groupRole?: string;
}

interface GroupAIConfig {
  groupId: number;
  apiUrl: string;
  apiKey: string;
  model: string;
  botName: string;
  updatedAt?: string;
}

interface GroupSettingsModalProps {
  isOpen: boolean;
  group: ChannelGroup | null;
  currentUserId?: number;
  onClose: () => void;
  onSaved?: () => void;
}

type TabKey = 'basic' | 'roles' | 'members' | 'ai';

const emptyRoleForm = {
  name: '',
  description: '',
  color: '#6366f1',
  position: 10,
  isDefault: false,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getAssetUrl(path?: string) {
  return config.api.imageUrl(path);
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  group,
  currentUserId,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [groupForm, setGroupForm] = useState({ name: '', description: '', icon: '' });
  const [roles, setRoles] = useState<GroupRole[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [aiConfigForm, setAiConfigForm] = useState({ botName: 'AI', apiUrl: '', apiKey: '', model: '' });
  const [aiConfigUpdatedAt, setAiConfigUpdatedAt] = useState('');
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const wasOpenRef = useRef(false);
  const activeGroupIdRef = useRef<number | null>(null);

  const isOwner = useMemo(() => Boolean(group && currentUserId && group.ownerId === currentUserId), [group, currentUserId]);
  const sortedRoles = useMemo(() => [...roles].sort((a, b) => a.position - b.position || a.id - b.id), [roles]);
  const sortedMembers = useMemo(() => sortMembersByRole(members, sortedRoles), [members, sortedRoles]);
  const assignableRoles = useMemo(
    () => sortedRoles.filter((role) => role.name !== 'owner' && role.name !== 'bot'),
    [sortedRoles]
  );
  const isAIBotEnabled = useMemo(
    () => members.some((member) => member.groupRole === 'bot' || member.role === 'bot' || member.username === 'AI'),
    [members]
  );

  const fetchData = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError('');
    try {
      const [roleItems, memberItems] = await Promise.all([
        api.get<GroupRole[]>(`/api/groups/${group.id}/roles`),
        api.get<GroupMember[]>(`/api/groups/${group.id}/members`),
      ]);

      setRoles(Array.isArray(roleItems) ? roleItems : []);
      setMembers(Array.isArray(memberItems) ? memberItems : []);

      if (group.ownerId === currentUserId) {
        try {
          const aiConfig = await api.get<GroupAIConfig>(`/api/groups/${group.id}/ai-config`);
          setAiConfigForm({
            botName: aiConfig?.botName || 'AI',
            apiUrl: aiConfig?.apiUrl || '',
            apiKey: aiConfig?.apiKey || '',
            model: aiConfig?.model || '',
          });
          setAiConfigUpdatedAt(aiConfig?.updatedAt || '');
        } catch (aiConfigError) {
          if (!(aiConfigError instanceof ApiError) || aiConfigError.status !== 404) {
            throw aiConfigError;
          }
          setAiConfigForm({ botName: 'AI', apiUrl: '', apiKey: '', model: '' });
          setAiConfigUpdatedAt('');
        }
      } else {
        setAiConfigForm({ botName: 'AI', apiUrl: '', apiKey: '', model: '' });
        setAiConfigUpdatedAt('');
        if (activeTab === 'ai') setActiveTab('basic');
      }
    } catch (fetchError) {
      setError(getErrorMessage(fetchError, '加载群组设置失败'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentUserId, group]);

  useEffect(() => {
    if (!isOpen || !group) {
      wasOpenRef.current = false;
      activeGroupIdRef.current = null;
      return;
    }

    const isNewOpenSession = !wasOpenRef.current || activeGroupIdRef.current !== group.id;
    if (isNewOpenSession) {
      setActiveTab('basic');
      setRoleForm(emptyRoleForm);
      setEditingRoleId(null);
    }

    setGroupForm({
      name: group.name || '',
      description: group.description || '',
      icon: group.icon || '',
    });
    setError('');
    wasOpenRef.current = true;
    activeGroupIdRef.current = group.id;
    void fetchData();
  }, [fetchData, isOpen, group]);

  const saveBasicInfo = async () => {
    if (!group || !groupForm.name.trim()) {
      setError('群组名称不能为空');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.put<ChannelGroup>(`/api/groups/${group.id}`, {
        name: groupForm.name.trim(),
        description: groupForm.description.trim(),
        icon: groupForm.icon,
      });

      onSaved?.();
      window.dispatchEvent(new Event('groups:refresh'));
    } catch (saveError) {
      setError(getErrorMessage(saveError, '保存群组信息失败'));
    } finally {
      setSaving(false);
    }
  };

  const uploadGroupIcon = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);

      const payload = await api.upload<{ url?: string }>('/api/upload', formData);
      setGroupForm((prev) => ({ ...prev, icon: payload?.url || '' }));
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, '上传图片失败'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const resetRoleForm = () => {
    setRoleForm(emptyRoleForm);
    setEditingRoleId(null);
  };

  const saveRole = async () => {
    if (!group || !roleForm.name.trim()) return;

    setSaving(true);
    setError('');
    try {
      const endpoint = editingRoleId
        ? `/api/groups/${group.id}/roles/${editingRoleId}`
        : `/api/groups/${group.id}/roles`;
      const body = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        color: roleForm.color,
        position: Number(roleForm.position) || 0,
        isDefault: roleForm.isDefault,
      };
      if (editingRoleId) {
        await api.put<GroupRole>(endpoint, body);
      } else {
        await api.post<GroupRole>(endpoint, body);
      }

      resetRoleForm();
      await fetchData();
      onSaved?.();
    } catch (saveError) {
      setError(getErrorMessage(saveError, '保存身份组失败'));
    } finally {
      setSaving(false);
    }
  };

  const editRole = (role: GroupRole) => {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description || '',
      color: role.color || '#6366f1',
      position: role.position || 0,
      isDefault: role.isDefault,
    });
    setActiveTab('roles');
  };

  const deleteRole = async (role: GroupRole) => {
    if (!group || !window.confirm(`确定删除身份组「${roleLabel(role.name)}」吗？`)) return;

    setSaving(true);
    setError('');
    try {
      await api.delete<null>(`/api/groups/${group.id}/roles/${role.id}`);
      await fetchData();
      onSaved?.();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, '删除身份组失败'));
    } finally {
      setSaving(false);
    }
  };

  const assignMemberRole = async (memberId: number, roleId: number) => {
    if (!group || !roleId) return;

    setError('');
    try {
      await api.put<null>(`/api/groups/${group.id}/members/${memberId}/role`, { roleId });
      await fetchData();
      onSaved?.();
    } catch (assignError) {
      setError(getErrorMessage(assignError, '更新成员身份失败'));
    }
  };

  const toggleAIBot = async () => {
    if (!group || !isOwner) return;

    setAiSaving(true);
    setError('');
    try {
      if (isAIBotEnabled) {
        await api.delete<null>(`/api/groups/${group.id}/ai-bot`);
      } else {
        await api.post<null>(`/api/groups/${group.id}/ai-bot`, {});
      }
      await fetchData();
      onSaved?.();
    } catch (toggleError) {
      setError(getErrorMessage(toggleError, '更新 AI 机器人失败'));
    } finally {
      setAiSaving(false);
    }
  };

  const saveAIConfig = async () => {
    if (!group || !isOwner || !aiConfigForm.apiUrl.trim()) {
      setError('AI 接口链接不能为空');
      return;
    }

    setAiConfigSaving(true);
    setError('');
    try {
      const savedConfig = await api.put<GroupAIConfig>(`/api/groups/${group.id}/ai-config`, {
        apiUrl: aiConfigForm.apiUrl.trim(),
        apiKey: aiConfigForm.apiKey.trim(),
        model: aiConfigForm.model.trim(),
        botName: aiConfigForm.botName.trim(),
      });
      if (savedConfig) {
        setAiConfigForm({
          botName: savedConfig.botName || 'AI',
          apiUrl: savedConfig.apiUrl || '',
          apiKey: savedConfig.apiKey || '',
          model: savedConfig.model || '',
        });
      }
      setAiConfigUpdatedAt(savedConfig?.updatedAt || '');
    } catch (saveError) {
      setError(getErrorMessage(saveError, '保存 AI 配置失败'));
    } finally {
      setAiConfigSaving(false);
    }
  };

  const deleteAIConfig = async () => {
    if (!group || !isOwner || !window.confirm('确定删除该群的 AI 接口配置吗？')) return;

    setAiConfigSaving(true);
    setError('');
    try {
      await api.delete<null>(`/api/groups/${group.id}/ai-config`);
      setAiConfigForm({ botName: 'AI', apiUrl: '', apiKey: '', model: '' });
      setAiConfigUpdatedAt('');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, '删除 AI 配置失败'));
    } finally {
      setAiConfigSaving(false);
    }
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#111113] text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white">群组设置</h3>
            <p className="mt-1 text-sm text-zinc-500">管理基本信息、身份组和成员权限</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[190px_1fr]">
          <aside className="flex gap-2 overflow-x-auto border-b border-zinc-800 bg-[#151517] p-3 md:block md:overflow-visible md:border-b-0 md:border-r">
            {[
              { key: 'basic', label: '基本信息', icon: <ImageIcon className="h-4 w-4" /> },
              { key: 'roles', label: '身份组', icon: <Shield className="h-4 w-4" /> },
              { key: 'members', label: '成员管理', icon: <Users className="h-4 w-4" /> },
              ...(isOwner ? [{ key: 'ai', label: 'AI 机器人', icon: <Bot className="h-4 w-4" /> }] : []),
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`mb-0 flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors md:mb-1 md:w-full ${
                  activeTab === tab.key
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </aside>

          <section className="min-h-0 overflow-y-auto p-5">
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中
              </div>
            ) : activeTab === 'basic' ? (
              <div className="max-w-3xl space-y-7">
                <div className="grid gap-4 sm:grid-cols-[156px_1fr] sm:items-center">
                  <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-zinc-800 text-4xl font-bold text-zinc-300">
                    {getAssetUrl(groupForm.icon) ? (
                      <Image
                        src={getAssetUrl(groupForm.icon)}
                        alt={groupForm.name || '群头像'}
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    ) : groupForm.icon ? (
                      <span>{groupForm.icon}</span>
                    ) : (
                      <ImageIcon className="h-10 w-10 text-zinc-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">群头像</h4>
                    <p className="mt-1 text-sm text-zinc-500">上传图片后会同步到左侧群组图标。</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
                        <Upload className="h-4 w-4" />
                        {uploading ? '上传中...' : '上传图片'}
                        <input type="file" accept="image/*" onChange={uploadGroupIcon} className="hidden" disabled={uploading} />
                      </label>
                      <button
                        onClick={() => setGroupForm((prev) => ({ ...prev, icon: '' }))}
                        className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                      >
                        移除图片
                      </button>
                    </div>
                  </div>
                </div>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">群名称</span>
                    <span className="text-xs text-zinc-500">{groupForm.name.length}/50</span>
                  </div>
                  <input
                    value={groupForm.name}
                    onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value.slice(0, 50) }))}
                    className="w-full border-b border-zinc-700 bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-indigo-500"
                    placeholder="输入群名称"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">群介绍</span>
                    <span className="text-xs text-zinc-500">{groupForm.description.length}/200</span>
                  </div>
                  <textarea
                    value={groupForm.description}
                    onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value.slice(0, 200) }))}
                    className="min-h-28 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-indigo-500"
                    placeholder="暂无介绍"
                  />
                </label>

                <div className="flex justify-end border-t border-zinc-800 pt-5">
                  <button
                    onClick={saveBasicInfo}
                    disabled={saving || uploading || !groupForm.name.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? '保存中...' : '保存修改'}
                  </button>
                </div>
              </div>
            ) : activeTab === 'roles' ? (
              <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{editingRoleId ? '编辑身份组' : '创建身份组'}</h4>
                    {editingRoleId && (
                      <button onClick={resetRoleForm} className="text-xs text-zinc-400 hover:text-zinc-200">
                        取消编辑
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">名称</span>
                      <input
                        value={roleForm.name}
                        onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">描述</span>
                      <input
                        value={roleForm.description}
                        onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 block text-xs text-zinc-400">颜色</span>
                        <input
                          type="color"
                          value={roleForm.color}
                          onChange={(event) => setRoleForm((prev) => ({ ...prev, color: event.target.value }))}
                          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-1 py-1"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-zinc-400">排序</span>
                        <input
                          type="number"
                          value={roleForm.position}
                          onChange={(event) => setRoleForm((prev) => ({ ...prev, position: Number(event.target.value) }))}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={roleForm.isDefault}
                        onChange={(event) => setRoleForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                      />
                      设为新成员默认身份
                    </label>
                    <button
                      onClick={saveRole}
                      disabled={saving || !roleForm.name.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {editingRoleId ? '更新身份组' : '创建身份组'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {sortedRoles.map((role) => (
                    <div key={role.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-white">{roleLabel(role.name)}</span>
                            <span className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: role.color || '#52525b' }}>
                              {role.color || '#52525b'}
                            </span>
                            {role.isDefault && <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">默认</span>}
                            {role.isSystem && <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">系统</span>}
                          </div>
                          <p className="mt-1 text-sm text-zinc-500">{role.description || '暂无描述'}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => editRole(role)}
                            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => deleteRole(role)}
                            disabled={saving || role.isSystem}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3 w-3" />
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'members' ? (
              <div className="overflow-hidden rounded-lg border border-zinc-800">
                <div className="grid grid-cols-[1.4fr_0.8fr_0.9fr] gap-3 border-b border-zinc-800 bg-zinc-900/70 px-4 py-3 text-xs text-zinc-500">
                  <div>成员</div>
                  <div>当前身份</div>
                  <div>设置身份</div>
                </div>
                <div className="max-h-[520px] divide-y divide-zinc-800 overflow-y-auto">
                  {sortedMembers.map((member) => {
                    const currentRoleName = getMemberRoleName(member);
                    const currentRole = sortedRoles.find((role) => role.name === currentRoleName);
                    const selectedRoleId = currentRole?.id || '';
                    return (
                      <div key={member.id} className="grid grid-cols-[1.4fr_0.8fr_0.9fr] items-center gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-500/20 text-sm font-semibold text-white">
                            {getAssetUrl(member.avatarUrl) ? (
                              <Image
                                src={config.api.avatarThumbUrl(member.avatarUrl, 36)}
                                alt={member.username}
                                fill
                                sizes="36px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              member.avatar || member.username.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm text-white">{member.username}</div>
                            <div className={member.isOnline ? 'text-xs text-green-400' : 'text-xs text-zinc-500'}>
                              {member.isOnline ? '在线' : '离线'}
                            </div>
                          </div>
                        </div>
                        <div>
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-xs"
                            style={currentRole?.color ? { backgroundColor: `${currentRole.color}22`, color: currentRole.color } : undefined}
                          >
                            {roleLabel(currentRoleName)}
                          </span>
                        </div>
                        <div>
                          {currentRoleName === 'owner' || member.id === currentUserId || (!isOwner && currentRoleName === 'admin') ? (
                            <span className="text-xs text-zinc-500">{currentRoleName === 'owner' ? '所有者不可修改' : '不可修改'}</span>
                          ) : (
                            <select
                              value={selectedRoleId}
                              onChange={(event) => assignMemberRole(member.id, Number(event.target.value))}
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                            >
                              <option value="" disabled>选择身份</option>
                              {assignableRoles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {roleLabel(role.name)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {members.length === 0 && (
                    <div className="py-10 text-center text-sm text-zinc-500">暂无成员</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl space-y-5">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-500/15 text-green-300">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-white">AI 群助手</h4>
                          <p className="mt-1 text-sm text-zinc-500">
                            只有群主可以查看和修改接口配置。添加后成员可以在频道里 @{aiConfigForm.botName.trim() || 'AI'} 提问。
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${isAIBotEnabled ? 'bg-green-500/15 text-green-300' : 'bg-zinc-800 text-zinc-400'}`}>
                          {isAIBotEnabled ? '已添加' : '未添加'}
                        </span>
                      </div>
                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={toggleAIBot}
                          disabled={aiSaving}
                          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                            isAIBotEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                          }`}
                        >
                          {aiSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                          {isAIBotEnabled ? '移除机器人' : '添加机器人'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-white">接口配置</h4>
                      <p className="mt-1 text-sm text-zinc-500">配置该群自己的 AI API 链接、密钥和模型。</p>
                    </div>
                    {aiConfigUpdatedAt && (
                      <span className="text-xs text-zinc-500">
                        已保存 {new Date(aiConfigUpdatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">AI 名称</span>
                      <input
                        value={aiConfigForm.botName}
                        onChange={(event) => setAiConfigForm((prev) => ({ ...prev, botName: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        placeholder="AI"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">API 链接</span>
                      <input
                        value={aiConfigForm.apiUrl}
                        onChange={(event) => setAiConfigForm((prev) => ({ ...prev, apiUrl: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        placeholder="https://example.com/api/ai"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">API Key</span>
                      <input
                        type="password"
                        value={aiConfigForm.apiKey}
                        onChange={(event) => setAiConfigForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        placeholder="可选"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">模型</span>
                      <input
                        value={aiConfigForm.model}
                        onChange={(event) => setAiConfigForm((prev) => ({ ...prev, model: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        placeholder="例如 gpt-4o-mini，可选"
                      />
                    </label>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 pt-4">
                      <button
                        type="button"
                        onClick={deleteAIConfig}
                        disabled={aiConfigSaving || !aiConfigUpdatedAt}
                        className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        删除配置
                      </button>
                      <button
                        type="button"
                        onClick={saveAIConfig}
                        disabled={aiConfigSaving || !aiConfigForm.apiUrl.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {aiConfigSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        保存配置
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default GroupSettingsModal;
