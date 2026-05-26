"use client";

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import DirectMessageWorkspace from '@/components/dm/DirectMessageWorkspace';

export default function DirectMessagesPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user) {
      try {
        const userData = JSON.parse(user) as { id?: number };
        if (userData.id && String(userData.id) !== String(params.userId)) {
          router.replace(`/${userData.id}/dm`);
          return;
        }
      } catch {
        // Ignore stale local user data; API calls will surface auth problems.
      }
    }

    queueMicrotask(() => setIsReady(true));
  }, [params.userId, pathname, router]);

  if (!isReady) {
    return <div className="flex h-screen items-center justify-center bg-[#0f0f12] text-white">Loading...</div>;
  }

  return <DirectMessageWorkspace />;
}
