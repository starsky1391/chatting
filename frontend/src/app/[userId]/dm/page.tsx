"use client";

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import DirectMessageWorkspace from '@/components/dm/DirectMessageWorkspace';
import { getStoredToken, getStoredUser } from '@/store/useChatStore';

export default function DirectMessagesPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    const user = getStoredUser();
    if (user) {
      if (user.id && String(user.id) !== String(params.userId)) {
        router.replace(`/${user.id}/dm`);
        return;
      }
    }

    queueMicrotask(() => setIsReady(true));
  }, [params.userId, pathname, router]);

  if (!isReady) {
    return <div className="flex h-screen items-center justify-center bg-[#0f0f12] text-white">Loading...</div>;
  }

  return <DirectMessageWorkspace />;
}
