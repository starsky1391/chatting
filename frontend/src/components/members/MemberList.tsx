"use client";
import React, { useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { config } from '@/lib/config';

const MemberList: React.FC = () => {
  const { members, groupMembers, currentGroupId, currentChannel } = useChatStore();
  const [showGroupMembers, setShowGroupMembers] = useState(true);
  const [showChannelMembers, setShowChannelMembers] = useState(true);

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

  if (!currentGroupId) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-zinc-700/50">
          <h2 className="text-sm font-semibold text-zinc-400">Members</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          <p className="text-xs">Select a server</p>
        </div>
      </div>
    );
  }

  const getOnlineOffline = (memberList: typeof groupMembers) => {
    const online = memberList.filter(m => m.isOnline);
    const offline = memberList.filter(m => !m.isOnline);
    return { online, offline };
  };

  const renderMemberList = (memberList: typeof groupMembers, title: string, isExpanded: boolean, toggleExpand: () => void) => {
    if (memberList.length === 0) return null;

    const { online, offline } = getOnlineOffline(memberList);

    return (
      <div className="mb-3">
        <button
          onClick={toggleExpand}
          className="flex items-center justify-between w-full px-2 py-1 hover:bg-zinc-700/30 rounded transition-all"
        >
          <div className="flex items-center gap-1">
            <svg
              className={`w-3 h-3 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-semibold text-zinc-400 uppercase">{title}</span>
          </div>
          <span className="text-xs text-zinc-600">{memberList.length}</span>
        </button>

        {isExpanded && (
          <div className="space-y-0.5 mt-1">
            {online.length > 0 && (
              <div className="mb-1">
                <span className="text-xs text-zinc-500 px-2">Online — {online.length}</span>
                {online.map((member) => renderMemberItem(member))}
              </div>
            )}

            {offline.length > 0 && (
              <div>
                <span className="text-xs text-zinc-500 px-2">Offline — {offline.length}</span>
                {offline.map((member) => renderMemberItem(member))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMemberItem = (member: typeof groupMembers[0]) => {
    const roleBadge = getRoleBadge(member.role);
    return (
      <div
        key={member.id}
        className="group px-2 py-1.5 rounded hover:bg-zinc-700/30 cursor-pointer transition-all"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-6 h-6 rounded bg-indigo-500/20 flex items-center justify-center text-xs font-bold overflow-hidden">
              {member.avatarUrl ? (
                <img src={`${config.api.baseUrl}${member.avatarUrl}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                member.avatar || member.username?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-800 ${member.isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span className="text-xs text-zinc-300 truncate">{member.username}</span>
            {roleBadge && (
              <span className={`text-xs px-1 rounded ${roleBadge.color}`}>
                {roleBadge.text}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-zinc-700/50">
        <h2 className="text-sm font-semibold text-zinc-400">Members</h2>
      </div>

      {/* Member Lists */}
      <div className="flex-1 overflow-y-auto p-2">
        {currentChannel ? (
          <>
            {renderMemberList(groupMembers, 'Server Members', showGroupMembers, () => setShowGroupMembers(!showGroupMembers))}
            {renderMemberList(members, 'In Channel', showChannelMembers, () => setShowChannelMembers(!showChannelMembers))}
          </>
        ) : (
          <>
            {renderMemberList(groupMembers, 'Server Members', showGroupMembers, () => setShowGroupMembers(!showGroupMembers))}
          </>
        )}
      </div>
    </div>
  );
};

export default MemberList;