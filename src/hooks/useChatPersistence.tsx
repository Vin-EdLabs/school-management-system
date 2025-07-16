
import { useState, useEffect, useCallback } from 'react';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  action?: 'receipt' | 'payment' | 'info' | 'balance' | 'stats' | 'search' | 'list' | 'report';
  data?: any;
  isTyping?: boolean;
}

const STORAGE_KEY = 'ai_chat_messages';
const CHAT_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

export const useChatPersistence = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Hello! I\'m your AI assistant for Rosa Gardens School. I can help you with:\n\n💰 Record payments and generate receipts\n📊 Get school statistics and reports\n👥 Find student information and balances\n📋 List students by various criteria\n📄 Generate and view receipts\n\nWhat would you like to do today?',
      timestamp: new Date()
    }
  ]);

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const { messages: savedMessages, timestamp } = JSON.parse(savedData);
        const now = new Date().getTime();
        const savedTime = new Date(timestamp).getTime();
        
        // Check if messages are still valid (within 10 minutes)
        if (now - savedTime < CHAT_EXPIRY_TIME) {
          setMessages(savedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
        } else {
          // Clear expired messages
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error('Error loading chat messages:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 1) { // Don't save if only welcome message exists
      const dataToSave = {
        messages,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }

    // Set up auto-clear timer
    const timer = setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY);
      setMessages([{
        id: '1',
        type: 'ai',
        content: 'Hello! I\'m your AI assistant for Rosa Gardens School. I can help you with:\n\n💰 Record payments and generate receipts\n📊 Get school statistics and reports\n👥 Find student information and balances\n📋 List students by various criteria\n📄 Generate and view receipts\n\nWhat would you like to do today?',
        timestamp: new Date()
      }]);
    }, CHAT_EXPIRY_TIME);

    return () => clearTimeout(timer);
  }, [messages]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const clearMessages = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([{
      id: '1',
      type: 'ai',
      content: 'Hello! I\'m your AI assistant for Rosa Gardens School. I can help you with:\n\n💰 Record payments and generate receipts\n📊 Get school statistics and reports\n👥 Find student information and balances\n📋 List students by various criteria\n📄 Generate and view receipts\n\nWhat would you like to do today?',
      timestamp: new Date()
    }]);
  }, []);

  return {
    messages,
    addMessage,
    clearMessages
  };
};
