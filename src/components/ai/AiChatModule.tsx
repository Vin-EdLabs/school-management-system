
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Bot, Send, User, Receipt, Sparkles, MessageCircle, Clock, Trash2 } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { useChatPersistence } from '../../hooks/useChatPersistence';
import { AIProcessor } from '../../utils/aiProcessor';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  action?: 'receipt' | 'payment' | 'info' | 'balance' | 'stats' | 'search' | 'list';
  data?: any;
}

const AiChatModule = () => {
  const { user, hasAccess } = useAuth();
  const { students, teachers, payments, feeStructures, addPayment, classes } = useData();
  const { messages, addMessage, clearMessages } = useChatPersistence();
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check access
  if (!hasAccess('ai-assistant')) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <Bot className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">Only Super Admin and Finance roles can access the AI Assistant.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const processUserInput = async (input: string): Promise<void> => {
    setIsProcessing(true);
    
    try {
      const processor = new AIProcessor({
        students,
        teachers,
        payments,
        feeStructures,
        classes,
        addPayment
      });

      const response = await processor.processInput(input);
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: 'ai',
        content: typeof response === 'string' ? response : response.content,
        timestamp: new Date(),
        action: typeof response === 'object' ? response.action : undefined,
        data: typeof response === 'object' ? response.data : undefined
      };

      addMessage(aiMessage);

      if (typeof response === 'object' && response.action === 'payment') {
        toast({
          title: "Payment Recorded",
          description: "Payment has been successfully recorded and receipt generated.",
        });
      }
    } catch (error) {
      console.error('AI processing error:', error);
      addMessage({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again or rephrase your question.',
        timestamp: new Date()
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    addMessage(userMessage);
    const currentInput = inputValue;
    setInputValue('');

    await processUserInput(currentInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleShowReceipt = (data: any) => {
    setReceiptData(data);
    setShowReceipt(true);
  };

  const handleClearChat = () => {
    clearMessages();
    toast({
      title: "Chat Cleared",
      description: "Chat history has been cleared.",
    });
  };

  const formatMessageContent = (content: string) => {
    // Convert bullet points and formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
  };

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl">
                <Bot className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI School Assistant
                </h1>
                <p className="text-gray-600 flex items-center space-x-1">
                  <Sparkles className="w-4 h-4" />
                  <span>Intelligent database operations & school management</span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Auto-clear in 10min</span>
              </Badge>
              <Badge variant="outline" className="text-xs">
                {user?.role === 'super-admin' ? 'Super Admin' : 'Finance'} Access
              </Badge>
            </div>
          </div>
        </div>

        <Card className="h-[75vh] flex flex-col shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="pb-4 border-b bg-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <span>Chat Assistant</span>
                <Badge variant="secondary" className="text-xs">
                  {messages.length - 1} messages
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-gray-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              <div className="space-y-6">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                        : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                    } rounded-2xl p-4 relative`}>
                      
                      {/* Avatar */}
                      <div className={`absolute -top-2 ${message.type === 'user' ? '-right-2' : '-left-2'} w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-purple-100 to-blue-100 text-blue-600'
                      } shadow-md`}>
                        {message.type === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>

                      <div className="mt-2">
                        <div 
                          className="text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
                        />
                        
                        {/* Action buttons */}
                        {(message.action === 'receipt' || message.action === 'payment') && message.data && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShowReceipt(message.data)}
                            className={`mt-3 ${
                              message.type === 'user' 
                                ? 'text-blue-100 hover:text-white hover:bg-blue-500' 
                                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                            }`}
                          >
                            <Receipt className="w-4 h-4 mr-1" />
                            View Receipt
                          </Button>
                        )}
                      </div>
                      
                      <div className={`text-xs mt-2 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 border rounded-2xl p-4 max-w-[85%] relative">
                      <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 text-blue-600 shadow-md flex items-center justify-center">
                        <Bot className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-gray-600">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="p-4 border-t bg-white rounded-b-lg">
              <div className="flex space-x-3">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about the school, record payments, check balances..."
                  className="flex-1 border-2 border-gray-200 focus:border-blue-400 rounded-xl px-4 py-3"
                  disabled={isProcessing}
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!inputValue.trim() || isProcessing}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl shadow-md"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="bg-gray-100 px-2 py-1 rounded-full">💰 "Record payment of 500 for STU001"</span>
                <span className="bg-gray-100 px-2 py-1 rounded-full">📄 "Show receipt for John Doe"</span>
                <span className="bg-gray-100 px-2 py-1 rounded-full">👥 "Which students owe money?"</span>
                <span className="bg-gray-100 px-2 py-1 rounded-full">📊 "How many students?"</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {receiptData && (
        <ReceiptPrinter
          receiptData={receiptData}
          show={showReceipt}
          onClose={() => setShowReceipt(false)}
          onPrint={() => {
            toast({
              title: "Receipt Generated",
              description: "Receipt has been generated successfully",
            });
          }}
        />
      )}
    </>
  );
};

export default AiChatModule;
