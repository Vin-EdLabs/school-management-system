import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (token) {
      const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace('/api', '');
      
      const s = io(SOCKET_URL, {
        auth: { token },
        autoConnect: true,
      });

      s.on('connect', () => {
        setConnected(true);
        console.log('💬 Socket connected');
      });

      s.on('disconnect', () => {
        setConnected(false);
        console.log('💬 Socket disconnected');
      });

      setSocket(s);

      return () => {
        s.disconnect();
      };
    } else {
      setSocket(null);
      setConnected(false);
    }
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
