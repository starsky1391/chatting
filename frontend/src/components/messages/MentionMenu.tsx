"use client";

import React from 'react';
import { AtSign } from 'lucide-react';
import { config } from '@/lib/config';
import type { MentionMember } from './types';

type MentionMenuProps = {
  isOpen: boolean;
  candidates: MentionMember[];
  activeIndex: number;
  onSelect: (member: MentionMember) => void;
};

const MentionMenu: React.FC<MentionMenuProps> = ({
  isOpen,
  candidates,
  activeIndex,
  onSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="mb-2 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950/95 p-1 shadow-2xl">
      {candidates.length > 0 ? (
        candidates.map((member, index) => {
          const isBot = member.groupRole === 'bot' || member.role === 'bot' || member.username === 'AI';
          const avatarUrl = member.avatarUrl || '';
          return (
            <button
              key={member.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(member);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-all ${
                activeIndex === index ? 'bg-indigo-500/20 text-white' : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-semibold ${
                isBot ? 'bg-green-500/20 text-green-300' : 'bg-indigo-500/20 text-indigo-200'
              }`}>
                {member.avatarUrl ? (
                  <img
                    src={avatarUrl.startsWith('http') ? avatarUrl : `${config.api.baseUrl}${avatarUrl}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  member.avatar || member.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">@{member.username}</div>
                {isBot && <div className="text-xs text-green-300/80">AI 机器人</div>}
              </div>
            </button>
          );
        })
      ) : (
        <div className="flex items-center gap-2 px-2 py-2 text-sm text-zinc-500">
          <AtSign className="h-4 w-4" />
          没有匹配的成员
        </div>
      )}
    </div>
  );
};

export default MentionMenu;
