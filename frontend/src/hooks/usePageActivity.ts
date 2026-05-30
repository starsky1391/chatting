"use client";

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    __CHAT_DESKTOP_BACKGROUND__?: boolean;
  }
}

export function isPageActive() {
  if (typeof document === 'undefined') return true;
  return !document.hidden && window.__CHAT_DESKTOP_BACKGROUND__ !== true;
}

export function usePageActivity() {
  const [isActive, setIsActive] = useState(isPageActive);

  useEffect(() => {
    const updateActivity = () => setIsActive(isPageActive());

    document.addEventListener('visibilitychange', updateActivity);
    window.addEventListener('focus', updateActivity);
    window.addEventListener('blur', updateActivity);
    window.addEventListener('chatting-desktop-background', updateActivity);
    updateActivity();

    return () => {
      document.removeEventListener('visibilitychange', updateActivity);
      window.removeEventListener('focus', updateActivity);
      window.removeEventListener('blur', updateActivity);
      window.removeEventListener('chatting-desktop-background', updateActivity);
    };
  }, []);

  return isActive;
}
