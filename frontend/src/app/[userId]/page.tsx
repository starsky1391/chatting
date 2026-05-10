"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';

const MainLayout = dynamic(() => import('../../components/MainLayout'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading…</div>,
});

export default function UserHomePage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token) {
      // Redirect to login with current URL as redirect param
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // Verify the userId in URL matches the logged-in user
    if (user) {
      try {
        const userData = JSON.parse(user);
        const urlUserId = params.userId;
        if (urlUserId && String(userData.id) !== String(urlUserId)) {
          // URL userId doesn't match logged-in user, redirect to their own page
          router.replace(`/${userData.id}`);
          return;
        }
      } catch {
        // Ignore parse errors
      }
    }

    setIsLoading(false);
  }, [router, params.userId, pathname]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Checking authentication…</div>;
  }

  return <MainLayout />;
}
