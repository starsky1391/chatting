"use client";

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImageUp, Send } from 'lucide-react';
import { api } from '@/lib/api';
import MentionMenu from './MentionMenu';
import type { useMentionInput } from '@/hooks/useMentionInput';

type MessageComposerProps = {
  mentionInput: ReturnType<typeof useMentionInput>;
  onSendMessage: (content: string) => void;
  onBeforeSend?: () => void;
};

const MessageComposer: React.FC<MessageComposerProps> = ({
  mentionInput,
  onSendMessage,
  onBeforeSend,
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    input,
    inputRef,
    isMentionOpen,
    mentionCandidates,
    activeMentionIndex,
    handleInputChange,
    handleInputKeyDown,
    handleSubmit,
    updateMentionState,
    insertMention,
  } = mentionInput;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewImage((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
  };

  const handleCancelPreview = () => {
    setPreviewImage((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    return () => {
      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const data = await api.upload<{ url?: string }>('/api/upload', formData);
      return data?.url || null;
    } catch (error) {
      console.error('图片上传错误:', error);
      return null;
    }
  };

  const handleSendImage = async () => {
    if (!fileInputRef.current?.files?.[0]) return;

    setIsUploading(true);
    try {
      const file = fileInputRef.current.files[0];
      const imageUrl = await uploadImage(file);

      if (imageUrl) {
        onBeforeSend?.();
        onSendMessage(imageUrl);
        handleCancelPreview();
      }
    } catch (error) {
      console.error('发送图片错误:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-3 border-t border-zinc-700/50 bg-zinc-800/30">
      {previewImage && (
        <div className="mb-3 border border-zinc-700/50 bg-zinc-800/30 p-3 animate-fade-in">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-zinc-300">Image Preview</h3>
              <button
                type="button"
                onClick={handleCancelPreview}
                className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-red-400 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative max-w-md">
              <Image
                src={previewImage}
                alt="Preview"
                width={384}
                height={192}
                className="max-h-48 w-auto rounded-xl border border-zinc-700 object-contain"
                unoptimized
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelPreview}
                className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendImage}
                disabled={isUploading}
                className="px-4 py-2 bg-indigo-500 rounded-xl text-white font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? 'Sending...' : 'Send Image'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isMentionOpen && (
        <MentionMenu
          isOpen={isMentionOpen}
          candidates={mentionCandidates}
          activeIndex={activeMentionIndex}
          onSelect={insertMention}
        />
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-indigo-400 transition-all"
          title="Attach Image"
        >
          <ImageUp className="w-5 h-5" />
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onClick={(event) => updateMentionState(input, event.currentTarget.selectionStart)}
          placeholder="输入消息，使用 @ 提及成员..."
          className="flex-1 px-3 py-2 bg-zinc-700/30 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all text-sm"
          disabled={isUploading}
        />

        <button
          type="submit"
          disabled={isUploading || !input.trim()}
          className="px-4 py-2 bg-indigo-500 rounded-lg text-white font-medium disabled:opacity-50 flex items-center gap-2 hover:bg-indigo-600 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default MessageComposer;
