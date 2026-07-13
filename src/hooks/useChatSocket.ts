import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { resolveSocketBaseUrl, SOCKET_IO_OPTIONS } from '@/utils/socketUrl';
import type { ChatMessage } from '@/services/chatService';

export type ChatSocketHandlers = {
  onNewMessage?: (msg: ChatMessage) => void;
  onMessageDeleted?: (payload: { message_id: number; channel_id: number }) => void;
  onMessageAck?: (payload: { temp_id: string; real_id: number }) => void;
  onSendError?: (payload: { temp_id?: string; error: string }) => void;
  onTyping?: (payload: { channel_id: number; user_id: number; name: string }) => void;
  onStoppedTyping?: (payload: { channel_id: number; user_id: number }) => void;
  onUnreadChanged?: () => void;
};

export function useChatSocket(token: string | null, handlers: ChatSocketHandlers) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) return;
    const base = resolveSocketBaseUrl();
    const socket = io(`${base}/chat`, {
      ...SOCKET_IO_OPTIONS,
      auth: { token },
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('new_message', (msg) => handlersRef.current.onNewMessage?.(msg));
    socket.on('message_deleted', (p) => handlersRef.current.onMessageDeleted?.(p));
    socket.on('message_sent_ack', (p) => handlersRef.current.onMessageAck?.(p));
    socket.on('message_send_error', (p) => handlersRef.current.onSendError?.(p));
    socket.on('user_typing', (p) => handlersRef.current.onTyping?.(p));
    socket.on('user_stopped_typing', (p) => handlersRef.current.onStoppedTyping?.(p));
    socket.on('chat_unread_changed', () => handlersRef.current.onUnreadChanged?.());

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  const joinChannel = (channelId: number) => {
    socketRef.current?.emit('join_channel', { channel_id: channelId });
  };

  const sendMessage = (payload: {
    channel_id: number;
    message?: string;
    image_url?: string;
    image_thumbnail_url?: string;
    temp_id?: string;
  }) => {
    socketRef.current?.emit('send_message', payload);
  };

  const deleteMessage = (messageId: number) => {
    socketRef.current?.emit('delete_message', { message_id: messageId });
  };

  const markRead = (channelId: number) => {
    socketRef.current?.emit('mark_read', { channel_id: channelId });
    void import('@/services/chatService').then(({ chatService }) => chatService.markRead(channelId));
  };

  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  const typingStart = (channelId: number) => {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socketRef.current?.emit('typing_start', { channel_id: channelId });
    }, 300);
  };

  const typingStop = (channelId: number) => {
    if (typingTimer) clearTimeout(typingTimer);
    socketRef.current?.emit('typing_stop', { channel_id: channelId });
  };

  return {
    connected,
    joinChannel,
    sendMessage,
    deleteMessage,
    markRead,
    typingStart,
    typingStop,
  };
}
