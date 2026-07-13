import { useEffect, useRef } from 'react';
import { useChatSocketContext, type ChatSocketHandlers } from '@/contexts/ChatSocketContext';

export type { ChatSocketHandlers } from '@/contexts/ChatSocketContext';

export function useChatSocket(_token: string | null, handlers: ChatSocketHandlers) {
  const ctx = useChatSocketContext();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    ctx.setHandlers({
      onNewMessage: (msg) => handlersRef.current.onNewMessage?.(msg),
      onMessageDeleted: (p) => handlersRef.current.onMessageDeleted?.(p),
      onMessageAck: (p) => handlersRef.current.onMessageAck?.(p),
      onSendError: (p) => handlersRef.current.onSendError?.(p),
      onTyping: (p) => handlersRef.current.onTyping?.(p),
      onStoppedTyping: (p) => handlersRef.current.onStoppedTyping?.(p),
      onUnreadChanged: () => handlersRef.current.onUnreadChanged?.(),
      onConnect: () => handlersRef.current.onConnect?.(),
    });
    return () => ctx.setHandlers({});
  }, [ctx]);

  return {
    connected: ctx.connected,
    joinChannel: ctx.joinChannel,
    sendMessage: ctx.sendMessage,
    sendMessageOrWait: ctx.sendMessageOrWait,
    deleteMessage: ctx.deleteMessage,
    markRead: ctx.markRead,
    typingStart: ctx.typingStart,
    typingStop: ctx.typingStop,
    setActiveChannelId: ctx.setActiveChannelId,
  };
}
