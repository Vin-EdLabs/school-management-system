import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { resolveSocketBaseUrl, SOCKET_IO_OPTIONS } from '@/utils/socketUrl';
import { chatService, type ChatMessage } from '@/services/chatService';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';

export type ChatSocketHandlers = {
  onNewMessage?: (msg: ChatMessage) => void;
  onMessageDeleted?: (payload: { message_id: number; channel_id: number }) => void;
  onMessageAck?: (payload: { temp_id: string; real_id: number }) => void;
  onSendError?: (payload: { temp_id?: string; error: string }) => void;
  onTyping?: (payload: { channel_id: number; user_id: number; name: string }) => void;
  onStoppedTyping?: (payload: { channel_id: number; user_id: number }) => void;
  onUnreadChanged?: () => void;
  onConnect?: () => void;
};

type ChatSocketContextValue = {
  connected: boolean;
  joinChannel: (channelId: number) => void;
  sendMessage: (payload: {
    channel_id: number;
    message?: string;
    image_url?: string;
    image_thumbnail_url?: string;
    temp_id?: string;
  }) => boolean;
  sendMessageOrWait: (
    payload: {
      channel_id: number;
      message?: string;
      image_url?: string;
      image_thumbnail_url?: string;
      temp_id?: string;
    },
    timeoutMs?: number,
  ) => Promise<boolean>;
  deleteMessage: (messageId: number) => void;
  markRead: (channelId: number) => void;
  typingStart: (channelId: number) => void;
  typingStop: (channelId: number) => void;
  setActiveChannelId: (channelId: number | null) => void;
  setHandlers: (handlers: ChatSocketHandlers) => void;
};

const ChatSocketContext = createContext<ChatSocketContextValue | null>(null);

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [tenantId, setTenantId] = useState<number | null>(() => apiService.getTenantContext());
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<ChatSocketHandlers>({});
  const activeChannelIdRef = useRef<number | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const syncTenant = () => setTenantId(apiService.getTenantContext());
    syncTenant();
    window.addEventListener('storage', syncTenant);
    window.addEventListener('tenant-context-changed', syncTenant);
    return () => {
      window.removeEventListener('storage', syncTenant);
      window.removeEventListener('tenant-context-changed', syncTenant);
    };
  }, [token]);

  const joinActiveChannel = useCallback(() => {
    const channelId = activeChannelIdRef.current;
    if (channelId) {
      socketRef.current?.emit('join_channel', { channel_id: channelId });
    }
  }, []);

  const setHandlers = useCallback((handlers: ChatSocketHandlers) => {
    handlersRef.current = handlers;
  }, []);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const base = resolveSocketBaseUrl();
    const auth: { token: string; tenant_id?: number } = { token };
    if (tenantId != null) auth.tenant_id = tenantId;

    const socket = io(`${base}/chat`, {
      ...SOCKET_IO_OPTIONS,
      auth,
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      joinActiveChannel();
      handlersRef.current.onConnect?.();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('new_message', (msg) => handlersRef.current.onNewMessage?.(msg));
    socket.on('message_deleted', (p) => handlersRef.current.onMessageDeleted?.(p));
    socket.on('message_sent_ack', (p) => handlersRef.current.onMessageAck?.(p));
    socket.on('message_send_error', (p) => handlersRef.current.onSendError?.(p));
    socket.on('user_typing', (p) => handlersRef.current.onTyping?.(p));
    socket.on('user_stopped_typing', (p) => handlersRef.current.onStoppedTyping?.(p));
    socket.on('chat_unread_changed', () => {
      handlersRef.current.onUnreadChanged?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('comms-badges-refresh'));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, tenantId, joinActiveChannel]);

  const joinChannel = useCallback((channelId: number) => {
    activeChannelIdRef.current = channelId;
    socketRef.current?.emit('join_channel', { channel_id: channelId });
  }, []);

  const setActiveChannelId = useCallback((channelId: number | null) => {
    activeChannelIdRef.current = channelId;
    if (channelId && socketRef.current?.connected) {
      socketRef.current.emit('join_channel', { channel_id: channelId });
    }
  }, []);

  const sendMessage = useCallback(
    (payload: {
      channel_id: number;
      message?: string;
      image_url?: string;
      image_thumbnail_url?: string;
      temp_id?: string;
    }) => {
      if (!socketRef.current?.connected) return false;
      socketRef.current.emit('send_message', payload);
      return true;
    },
    [],
  );

  const sendMessageOrWait = useCallback(
    async (
      payload: {
        channel_id: number;
        message?: string;
        image_url?: string;
        image_thumbnail_url?: string;
        temp_id?: string;
      },
      timeoutMs = 3000,
    ) => {
      if (sendMessage(payload)) return true;
      const socket = socketRef.current;
      if (!socket) return false;

      return new Promise<boolean>((resolve) => {
        if (socket.connected) {
          socket.emit('send_message', payload);
          resolve(true);
          return;
        }

        const timer = window.setTimeout(() => {
          socket.off('connect', onConnect);
          resolve(false);
        }, timeoutMs);

        const onConnect = () => {
          window.clearTimeout(timer);
          socket.emit('send_message', payload);
          resolve(true);
        };

        socket.once('connect', onConnect);
      });
    },
    [sendMessage],
  );

  const deleteMessage = useCallback((messageId: number) => {
    socketRef.current?.emit('delete_message', { message_id: messageId });
  }, []);

  const markRead = useCallback((channelId: number) => {
    socketRef.current?.emit('mark_read', { channel_id: channelId });
    void chatService.markRead(channelId);
  }, []);

  const typingStart = useCallback((channelId: number) => {
    socketRef.current?.emit('typing_start', { channel_id: channelId });
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', { channel_id: channelId });
    }, 2800);
  }, []);

  const typingStop = useCallback((channelId: number) => {
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    socketRef.current?.emit('typing_stop', { channel_id: channelId });
  }, []);

  const value = useMemo(
    () => ({
      connected,
      joinChannel,
      sendMessage,
      sendMessageOrWait,
      deleteMessage,
      markRead,
      typingStart,
      typingStop,
      setActiveChannelId,
      setHandlers,
    }),
    [
      connected,
      joinChannel,
      sendMessage,
      sendMessageOrWait,
      deleteMessage,
      markRead,
      typingStart,
      typingStop,
      setActiveChannelId,
      setHandlers,
    ],
  );

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}

export function useChatSocketContext() {
  const ctx = useContext(ChatSocketContext);
  if (!ctx) {
    throw new Error('useChatSocketContext must be used within ChatSocketProvider');
  }
  return ctx;
}
