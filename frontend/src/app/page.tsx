"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token) {
      router.replace('/login');
      return;
    }

    // Redirect to user-specific home page
    if (user) {
      try {
        const userData = JSON.parse(user);
        router.replace(`/${userData.id}`);
        return;
      } catch {
        // Ignore parse errors
      }
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Redirecting…</div>;
  }

  return null;
}
