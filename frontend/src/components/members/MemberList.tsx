"use client";
/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { config } from '@/lib/config';
import { UserContextMenu, useUserContextMenu } from '@/components/user/UserContextMenu';

const MemberList: React.FC = () => {
  const { members, groupMembers, currentGroupId, currentChannel, isMemberSidebarOpen, toggleMemberSidebar } = useChatStore();
  const { menu, openUserMenu, closeUserMenu } = useUserContextMenu();

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return { text: 'Owner', color: 'bg-amber-500/20 text-amber-400' };
      case 'admin':
        return { text: 'Admin', color: 'bg-purple-500/20 text-purple-400' };
      case 'moderator':
        return { text: 'Mod', color: 'bg-blue-500/20 text-blue-400' };
      default:
        return null;
    }
  };

  const getOnlineOffline = (memberList: typeof groupMembers) => {
    const online = memberList.filter((member) => member.isOnline);
    const offline = memberList.filter((member) => !member.isOnline);
    return { online, offline };
  };

  const renderMemberItem = (member: typeof groupMembers[0]) => {
    const roleBadge = getRoleBadge(member.role);
    return (
      <div
        key={member.id}
        className="group cursor-pointer rounded px-2 py-1.5 transition-all hover:bg-zinc-700/30"
        onContextMenu={(event) => openUserMenu(event, member)}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded bg-indigo-500/20 text-xs font-bold">
              {member.avatarUrl ? (
                <img src={`${config.api.baseUrl}${member.avatarUrl}`} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                member.avatar || member.username?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-zinc-800 ${member.isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="truncate text-xs text-zinc-300">{member.username}</span>
            {roleBadge && (
              <span className={`rounded px-1 text-[10px] ${roleBadge.color}`}>{roleBadge.text}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMemberList = (memberList: typeof groupMembers, title: string) => {
    if (memberList.length === 0) return null;

    const { online, offline } = getOnlineOffline(memberList);

    return (
      <div className="mb-3">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-semibold uppercase text-zinc-400">{title}</span>
          <span className="text-xs text-zinc-600">{memberList.length}</span>
        </div>

        <div className="mt-1 space-y-0.5">
          {online.length > 0 && (
            <div className="mb-1">
              <span className="px-2 text-xs text-zinc-500">Online - {online.length}</span>
              {online.map((member) => renderMemberItem(member))}
            </div>
          )}

          {offline.length > 0 && (
            <div>
              <span className="px-2 text-xs text-zinc-500">Offline - {offline.length}</span>
              {offline.map((member) => renderMemberItem(member))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalCount = currentChannel ? members.length : groupMembers.length;

  if (!currentGroupId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-zinc-700/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-400">Members</h2>
          </div>
          <button
            type="button"
            onClick={toggleMemberSidebar}
            className="rounded-lg p-2 text-zinc-500 transition-all hover:bg-zinc-700/30 hover:text-white"
            title={isMemberSidebarOpen ? '折叠成员栏' : '展开成员栏'}
          >
            {isMemberSidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          <p className="text-xs">Select a server</p>
        </div>
      </div>
    );
  }

  if (!isMemberSidebarOpen) {
    return (
      <div className="flex h-full flex-col items-center gap-3 py-2">
        <button
          type="button"
          onClick={toggleMemberSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-700/50 text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
          title="展开成员栏"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-400">
          <Users className="h-4 w-4" />
        </div>
        <div className="text-center text-[10px] leading-tight text-zinc-500">
          <div>{totalCount}</div>
          <div>members</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <UserContextMenu menu={menu} onClose={closeUserMenu} />

      <div className="flex items-center justify-between border-b border-zinc-700/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-400">Members</h2>
          <span className="text-xs text-zinc-600">{totalCount}</span>
        </div>
        <button
          type="button"
          onClick={toggleMemberSidebar}
          className="rounded-lg p-2 text-zinc-500 transition-all hover:bg-zinc-700/30 hover:text-white"
          title="折叠成员栏"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto p-2">
        {currentChannel ? (
          <>
            {renderMemberList(groupMembers, 'Server Members')}
            {renderMemberList(members, 'In Channel')}
          </>
        ) : (
          <>
            {renderMemberList(groupMembers, 'Server Members')}
          </>
        )}
      </div>
    </div>
  );
};

export default MemberList;
