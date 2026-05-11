"use client";
import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { useChatStore } from '../../store/useChatStore';
import VoiceRoomLiveKit from '../voice/VoiceRoomLiveKit';
import { config } from '@/lib/config';
import { SkeletonMessageList } from '../ui/Skeleton';

interface MessageAreaProps {
  currentChannel: any;
  onSendMessage: (content: string) => void;
  onBack: () => void;
  isLoading?: boolean;
  showHeader?: boolean;
}

const MessageArea: React.FC<MessageAreaProps> = ({
  currentChannel,
  onSendMessage,
  onBack,
  isLoading = false,
  showHeader = true
}) => {
  const { messages, isInCall } = useChatStore();
  const [input, setInput] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancelPreview = () => {
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${config.api.baseUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('图片上传失败');

      const data = await response.json();
      return data.data.url;
    } catch (error) {
      console.error('图片上传错误:', error);
      return null;
    }
  };

  const handleSendImage = async () => {
    if (!fileInputRef.current?.files?.[0] || !currentChannel) return;

    setIsUploading(true);
    try {
      const file = fileInputRef.current.files[0];
      const imageUrl = await uploadImage(file);

      if (imageUrl) {
        onSendMessage(imageUrl);
        setPreviewImage(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('发送图片错误:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentChannel) return;

    onSendMessage(input);
    setInput('');
  };

  const handleBackClick = () => {
    onBack();
  };

  if (!currentChannel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-500/20 mb-6">
            <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to ChatApp</h2>
          <p className="text-zinc-400 max-w-md">
            Select a channel from the sidebar to start chatting.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {currentChannel.type === 'voice' ? (
          <VoiceRoomLiveKit currentChannel={currentChannel} />
        ) : (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <SkeletonMessageList count={6} />
              ) : messages.length > 0 ? (
                messages.map((message, index) => (
                  <div
                    key={message.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <MessageBubble message={message} />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-lg font-medium">No messages yet</p>
                  <p className="text-sm">Be the first to send a message!</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Image Preview */}
            {previewImage && (
              <div className="p-4 border-t border-zinc-700/50 bg-zinc-800/30 animate-fade-in">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-zinc-300">Image Preview</h3>
                    <button
                      onClick={handleCancelPreview}
                      className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-red-400 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="relative max-w-md">
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="max-h-48 object-contain rounded-xl border border-zinc-700"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelPreview}
                      className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
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

            {/* Input Area - Fixed at bottom */}
            <div className="p-3 border-t border-zinc-700/50 bg-zinc-800/30">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-indigo-400 transition-all"
                  title="Attach Image"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-zinc-700/30 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all text-sm"
                  disabled={isUploading}
                />

                <button
                  type="submit"
                  disabled={isUploading || !input.trim()}
                  className="px-4 py-2 bg-indigo-500 rounded-lg text-white font-medium disabled:opacity-50 flex items-center gap-2 hover:bg-indigo-600 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageArea;