import React, { createContext, useContext, useEffect } from 'react';

type MobileChatShellContextValue = {
  setMobileChatOpen: (open: boolean) => void;
};

const MobileChatShellContext = createContext<MobileChatShellContextValue | null>(null);

export function MobileChatShellProvider({
  setMobileChatOpen,
  children,
}: {
  setMobileChatOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <MobileChatShellContext.Provider value={{ setMobileChatOpen }}>
      {children}
    </MobileChatShellContext.Provider>
  );
}

/** Tell the app shell to hide the greeting header on phone while a chat thread is open. */
export function useSyncMobileChatOpen(active: boolean) {
  const ctx = useContext(MobileChatShellContext);
  useEffect(() => {
    ctx?.setMobileChatOpen(active);
    return () => ctx?.setMobileChatOpen(false);
  }, [active, ctx]);
}
