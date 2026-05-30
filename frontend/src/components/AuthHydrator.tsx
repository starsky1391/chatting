"use client";

import { useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';

export default function AuthHydrator() {
  const hydrateAuthFromStorage = useChatStore((state) => state.hydrateAuthFromStorage);

  useEffect(() => {
    hydrateAuthFromStorage();
  }, [hydrateAuthFromStorage]);

  return null;
}
