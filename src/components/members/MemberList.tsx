"use client";
import React from 'react';
import { useChatStore } from '../../store/useChatStore';

const MemberList: React.FC = () => {
  const { members } = useChatStore();

  // 获取状态显示
  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'idle':
        return 'bg-yellow-500';
      case 'do-not-disturb':
        return 'bg-red-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  // 获取角色标签
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Mod';
      case 'member':
        return 'Member';
      default:
        return 'Member';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 成员列表标题 */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold">Members ({members.length})</h2>
      </div>

      {/* 成员列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {members.map((member) => (
            <div key={member.id} className="px-4 py-2 rounded-lg hover:bg-gray-700 cursor-pointer">
              <div className="flex items-center gap-3">
                {/* 头像、状态和通话状态 */}
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-sm">
                    {member.avatar}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusIndicator(member.status)}`}></div>
                  {member.isInCall && (
                    <div className="absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 bg-green-500 animate-pulse" title="正在通话中"></div>
                  )}
                </div>

                {/* 成员信息 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{member.username}</span>
                    {member.isInCall && (
                      <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full animate-pulse">
                        通话中
                      </span>
                    )}
                    {member.role === 'admin' && (
                      <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded-full">
                        {getRoleLabel(member.role)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemberList;