"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { getStoredUser, useChatStore } from '@/store/useChatStore';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  avatar: string;
  avatarUrl: string;
  isOnline: boolean;
  role: string;
  bio: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const updateCurrentUser = useChatStore((state) => state.updateCurrentUser);
  const logout = useChatStore((state) => state.logout);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: ''
  });

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get('/api/user') as UserProfile;
      setProfile(data);
      setFormData({
        username: data.username || '',
        bio: data.bio || ''
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchProfile();
    });
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api.put('/api/user', formData) as UserProfile;
      setProfile(data);
      setEditing(false);
      updateCurrentUser({ username: data.username, bio: data.bio });
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const data = await api.upload<{ avatarUrl?: string }>('/api/user/avatar', formData);
      const avatarUrl = data?.avatarUrl;
      if (avatarUrl) {
        setProfile(prev => prev ? { ...prev, avatarUrl } : null);
        updateCurrentUser({ avatarUrl });
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0f0f12] via-[#1a1a2e] to-[#16213e]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f12] via-[#1a1a2e] to-[#16213e]">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative max-w-2xl mx-auto p-4 pt-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              const user = getStoredUser();
              if (user) {
                router.push(`/${user.id}`);
              } else {
                router.push('/');
              }
            }}
            className="p-2 rounded-xl glass hover:bg-zinc-700/50 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl font-bold gradient-text">My Profile</h1>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl glass hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Profile Card */}
        <div className="glass rounded-2xl p-6 shadow-2xl">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className="relative w-24 h-24 rounded-2xl gradient-bg flex items-center justify-center text-4xl font-bold shadow-xl overflow-hidden">
                {profile?.avatarUrl ? (
                  <Image
                    src={config.api.imageUrl(profile.avatarUrl)}
                    alt="Avatar"
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  profile?.avatar || profile?.username?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-zinc-800 ${profile?.isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />

              {/* Upload button */}
              <label className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full glass flex items-center justify-center cursor-pointer hover:bg-indigo-500/20 transition-all">
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>

            <h2 className="text-2xl font-bold mt-4">{profile?.username}</h2>
            <p className="text-zinc-400">{profile?.email}</p>
          </div>

          {/* Profile Form */}
          {editing ? (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 btn-primary rounded-xl text-white font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1">Username</label>
                <p className="text-white">{profile?.username}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1">Bio</label>
                <p className="text-white">{profile?.bio || 'No bio set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1">Role</label>
                <p className="text-white capitalize">{profile?.role}</p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 btn-primary rounded-xl text-white font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
