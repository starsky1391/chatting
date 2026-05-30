export type Channel = {
  id: number;
  name?: string;
  type: 'text' | 'voice';
};

export type CallParticipant = {
  userId: number;
  username: string;
  avatarUrl?: string;
};

export type MentionMember = {
  id: number;
  username: string;
  avatar?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  groupRole?: string;
  role?: string;
};

export type ApiMessage = {
  id: number;
  content: {
    type: string;
    body: string;
  };
  sender?: {
    id?: number;
    username?: string;
    avatar?: string;
    avatarUrl?: string;
    groupRole?: string;
  };
  createdAt: string | Date;
};

export type DisplayMessage = {
  id: number;
  content: {
    type: string;
    body: string;
  };
  sender: {
    id: number;
    username: string;
    avatar: string;
    avatarUrl?: string;
    groupRole?: string;
    email: string;
    isOnline: boolean;
    role: 'admin' | 'moderator' | 'member';
  };
  createdAt: string | Date;
  isOwn: boolean;
};

export type HistoryPreset = 'all' | 'today' | 'yesterday' | 'week' | 'custom';
