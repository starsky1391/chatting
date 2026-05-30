import type { Metadata } from "next";
import AuthHydrator from "@/components/AuthHydrator";
import RealtimeSoundNotifications from "@/components/notifications/RealtimeSoundNotifications";
import VoiceSessionDock from "@/components/voice/VoiceSessionDock";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chatting",
  description: "Chatting desktop and web client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthHydrator />
        {children}
        <RealtimeSoundNotifications />
        <VoiceSessionDock />
      </body>
    </html>
  );
}
