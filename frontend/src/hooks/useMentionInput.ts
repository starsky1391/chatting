import { useMemo, useRef, useState } from 'react';
import type { MentionMember } from '@/components/messages/types';

type UseMentionInputOptions = {
  members: MentionMember[];
  isEnabled: boolean;
  onSendMessage: (content: string) => void;
  onBeforeSend?: () => void;
};

export function useMentionInput({
  members,
  isEnabled,
  onSendMessage,
  onBeforeSend,
}: UseMentionInputOptions) {
  const [input, setInput] = useState('');
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const mentionCandidates = useMemo(() => {
    const normalizedQuery = mentionQuery.trim().toLowerCase();
    const uniqueMembers = new Map<number, MentionMember>();

    members.forEach((member) => {
      if (!member?.id || !member.username) return;
      uniqueMembers.set(member.id, member);
    });

    return Array.from(uniqueMembers.values())
      .filter((member) => {
        if (!normalizedQuery) return true;
        return member.username.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aIsBot = a.groupRole === 'bot' || a.role === 'bot' || a.username === 'AI';
        const bIsBot = b.groupRole === 'bot' || b.role === 'bot' || b.username === 'AI';
        if (aIsBot !== bIsBot) return aIsBot ? -1 : 1;
        return a.username.localeCompare(b.username, 'zh-Hans-CN');
      })
      .slice(0, 8);
  }, [members, mentionQuery]);

  const closeMentionMenu = () => {
    setIsMentionOpen(false);
    setMentionQuery('');
    setMentionStart(null);
    setActiveMentionIndex(0);
  };

  const getActiveMention = (value: string, cursor: number) => {
    const beforeCursor = value.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex === -1) return null;

    const token = beforeCursor.slice(atIndex + 1);
    if (/\s/.test(token) || token.includes('@')) return null;

    return { start: atIndex, query: token };
  };

  const updateMentionState = (value: string, cursor: number | null) => {
    const mention = getActiveMention(value, cursor ?? value.length);
    if (!mention || !isEnabled) {
      closeMentionMenu();
      return;
    }

    setMentionQuery(mention.query);
    setMentionStart(mention.start);
    setIsMentionOpen(true);
    setActiveMentionIndex(0);
  };

  const insertMention = (member: MentionMember) => {
    if (mentionStart === null) return;
    const inputEl = inputRef.current;
    const cursor = inputEl?.selectionStart ?? input.length;
    const nextInput = `${input.slice(0, mentionStart)}@${member.username} ${input.slice(cursor)}`;
    const nextCursor = mentionStart + member.username.length + 2;

    setInput(nextInput);
    closeMentionMenu();

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertMentionByUsername = (username: string) => {
    if (!username || !isEnabled) return;

    const inputEl = inputRef.current;
    const cursor = inputEl?.selectionStart ?? input.length;
    const before = input.slice(0, cursor);
    const after = input.slice(cursor);
    const leadingSpace = before && !/\s$/.test(before) ? ' ' : '';
    const mentionText = `@${username} `;
    const nextInput = `${before}${leadingSpace}${mentionText}${after}`;
    const nextCursor = before.length + leadingSpace.length + mentionText.length;

    setInput(nextInput);
    closeMentionMenu();

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInput(value);
    updateMentionState(value, event.target.selectionStart);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isMentionOpen || mentionCandidates.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveMentionIndex((index) => (index + 1) % mentionCandidates.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveMentionIndex((index) => (index - 1 + mentionCandidates.length) % mentionCandidates.length);
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      insertMention(mentionCandidates[activeMentionIndex]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMentionMenu();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !isEnabled) return;

    onBeforeSend?.();
    onSendMessage(input);
    setInput('');
    closeMentionMenu();
  };

  return {
    input,
    inputRef,
    isMentionOpen,
    mentionCandidates,
    activeMentionIndex,
    setInput,
    setIsMentionOpen,
    handleInputChange,
    handleInputKeyDown,
    handleSubmit,
    updateMentionState,
    insertMention,
    insertMentionByUsername,
  };
}
