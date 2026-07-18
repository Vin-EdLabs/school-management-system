import React, {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { getPartnerToken } from '@/services/partnerApi';
import { resolveSocketBaseUrl, SOCKET_IO_OPTIONS } from '@/utils/socketUrl';

type PartnerSocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const PartnerSocketContext = createContext<PartnerSocketContextValue>({
  socket: null,
  connected: false,
});

export function PartnerSocketProvider({
  enabled = true,
  children,
}: {
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const token = getPartnerToken();
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    let s: Socket | null = null;
    try {
      s = io(resolveSocketBaseUrl(), {
        ...SOCKET_IO_OPTIONS,
        auth: { token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 8,
      });
    } catch (err) {
      console.warn('[partner] Socket unavailable — live updates disabled', err);
      setSocket(null);
      setConnected(false);
      return;
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err: Error) => {
      console.warn('[partner] Socket connect error — falling back to polling', err.message);
      setConnected(false);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    if (s.connected) setConnected(true);
    setSocket(s);

    return () => {
      s?.off('connect', onConnect);
      s?.off('disconnect', onDisconnect);
      s?.off('connect_error', onConnectError);
      s?.removeAllListeners();
      s?.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [enabled]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return (
    <PartnerSocketContext.Provider value={value}>
      {children}
    </PartnerSocketContext.Provider>
  );
}

export function usePartnerSocket() {
  return useContext(PartnerSocketContext);
}
