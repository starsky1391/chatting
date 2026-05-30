"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredToken, getStoredUser } from '@/store/useChatStore';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace('/login');
      return;
    }

    // Redirect to user-specific home page
    const user = getStoredUser();
    if (user) {
      router.replace(`/${user.id}`);
      return;
    }

    queueMicrotask(() => setIsLoading(false));
  }, [router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Redirecting…</div>;
  }

  return null;
}
