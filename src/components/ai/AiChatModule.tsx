
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Bot, Send, User, Receipt, Sparkles, MessageCircle, Clock, Trash2, Command, Zap, ArrowUp } from 'lucide-react';
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

interface QuickCommand {
  id: string;
  icon: string;
  title: string;
  description: string;
  command: string;
  needsStudentId: boolean;
  category: string;
}

const quickCommands: QuickCommand[] = [
  {
    id: 'record-payment',
    icon: '💰',
    title: 'Record Payment',
    description: 'Record a new payment for a student',
    command: 'Record payment of [AMOUNT] for student [STUDENT]',
    needsStudentId: true,
    category: 'Payments'
  },
  {
    id: 'check-balance',
    icon: '💳',
    title: 'Check Balance',
    description: 'Check outstanding balance for a student',
    command: 'Check balance for [STUDENT]',
    needsStudentId: true,
    category: 'Balances'
  },
  {
    id: 'show-receipt',
    icon: '📄',
    title: 'Show Receipt',
    description: 'Show latest receipt for a student',
    command: 'Show receipt for [STUDENT]',
    needsStudentId: true,
    category: 'Receipts'
  },
  {
    id: 'all-receipts',
    icon: '📋',
    title: 'All Receipts',
    description: 'Show all receipts for a student',
    command: 'All receipts for [STUDENT]',
    needsStudentId: true,
    category: 'Receipts'
  },
  {
    id: 'students-owing',
    icon: '⚠️',
    title: 'Students Owing',
    description: 'List all students with outstanding balances',
    command: 'Which students owe money?',
    needsStudentId: false,
    category: 'Reports'
  },
  {
    id: 'all-students',
    icon: '👥',
    title: 'All Students',
    description: 'List all students in the school',
    command: 'List all students',
    needsStudentId: false,
    category: 'Students'
  },
  {
    id: 'statistics',
    icon: '📊',
    title: 'Statistics',
    description: 'Show school statistics and summary',
    command: 'Show school statistics',
    needsStudentId: false,
    category: 'Reports'
  },
  {
    id: 'find-student',
    icon: '🔍',
    title: 'Find Student',
    description: 'Search for a specific student',
    command: 'Find student [STUDENT]',
    needsStudentId: true,
    category: 'Students'
  }
];

const AiChatModule = () => {
  const { user, hasAccess } = useAuth();
  const { students, teachers, payments, feeStructures, addPayment, classes } = useData();
  const { messages, addMessage, clearMessages } = useChatPersistence();
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<QuickCommand | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
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
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again or rephrase your question.',
        timestamp: new Date()
      };
      addMessage(errorMessage);
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

  const handleCommandSelect = (command: QuickCommand) => {
    setSelectedCommand(command);
    
    if (!command.needsStudentId) {
      // Execute command immediately if it doesn't need student ID
      executeCommand(command, '', '');
    } else {
      // Show student input form
      setStudentQuery('');
      setPaymentAmount('');
    }
  };

  const executeCommand = async (command: QuickCommand, studentId: string = '', amount: string = '') => {
    let finalCommand = command.command;
    
    if (command.needsStudentId && studentId.trim()) {
      finalCommand = finalCommand.replace('[STUDENT]', studentId.trim());
      
      if (command.id === 'record-payment' && amount.trim()) {
        finalCommand = finalCommand.replace('[AMOUNT]', amount.trim());
      }
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: 'user',
      content: finalCommand,
      timestamp: new Date()
    };
    addMessage(userMessage);

    // Process the command
    await processUserInput(finalCommand);
    
    // Clear command state
    setSelectedCommand(null);
    setStudentQuery('');
    setPaymentAmount('');
  };

  const handleCommandExecution = () => {
    if (!selectedCommand) return;
    executeCommand(selectedCommand, studentQuery, paymentAmount);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedCommand) {
        handleCommandExecution();
      } else {
        handleSendMessage();
      }
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
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
  };

  const commandCategories = quickCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, QuickCommand[]>);

  return (
    <>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <div className="flex-shrink-0 p-4 bg-white border-b shadow-sm">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  AI Assistant
                </h1>
                <p className="text-sm text-gray-500">Rosa Gardens School Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                {messages.length - 1} messages
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-gray-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border text-gray-900'
                  } rounded-2xl p-4 shadow-sm`}>
                    
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' ? 'bg-blue-500' : 'bg-gray-100'
                      }`}>
                        {message.type === 'ai' ? <Bot className="w-4 h-4 text-gray-600" /> : <User className="w-4 h-4 text-white" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div 
                          className="text-sm leading-relaxed prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
                        />
                        
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
                        
                        <div className={`text-xs mt-2 ${
                          message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-white border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-gray-600 animate-pulse" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-gray-600">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Command Execution Form */}
          {selectedCommand && (
            <div className="flex-shrink-0 p-4 bg-blue-50 border-t">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-800 flex items-center">
                    <span className="text-lg mr-2">{selectedCommand.icon}</span>
                    {selectedCommand.title}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCommand(null)}
                    className="text-gray-500"
                  >
                    ✕
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {selectedCommand.id === 'record-payment' && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Payment Amount (GHS)</label>
                      <Input
                        type="number"
                        placeholder="Enter amount..."
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}
                  
                  {selectedCommand.needsStudentId && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Student ID or Name</label>
                      <Input
                        placeholder="Enter student ID or name..."
                        value={studentQuery}
                        onChange={(e) => setStudentQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="text-sm"
                      />
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleCommandExecution}
                    disabled={selectedCommand.needsStudentId && !studentQuery.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    Execute Command
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Commands Panel */}
          {showCommands && (
            <div className="flex-shrink-0 p-4 bg-gray-50 border-t max-h-64 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <Command className="w-4 h-4 mr-1" />
                  Quick Commands
                </h3>
                {Object.entries(commandCategories).map(([category, commands]) => (
                  <div key={category} className="mb-4">
                    <h4 className="text-xs font-medium text-gray-600 mb-2">{category}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {commands.map((command) => (
                        <Button
                          key={command.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleCommandSelect(command)}
                          className="h-auto p-3 flex flex-col items-start text-left hover:bg-blue-50 hover:border-blue-300"
                        >
                          <div className="text-lg mb-1">{command.icon}</div>
                          <div className="text-xs font-medium">{command.title}</div>
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{command.description}</div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="flex-shrink-0 p-4 bg-white border-t">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center space-x-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCommands(!showCommands)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Command className="w-4 h-4 mr-1" />
                  {showCommands ? 'Hide' : 'Show'} Commands
                </Button>
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Auto-clear in 10min
                </Badge>
              </div>
              
              <div className="flex items-end space-x-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about students, payments, or school management..."
                    className="pr-12 min-h-[44px] resize-none"
                    disabled={isProcessing}
                  />
                </div>
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!inputValue.trim() || isProcessing}
                  className="h-11 w-11 p-0 bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="bg-gray-100 px-2 py-1 rounded-full">💡 Try: "Record payment of 500 for student 20240001"</span>
                <span className="bg-gray-100 px-2 py-1 rounded-full">📄 "Show receipt for John Doe"</span>
                <span className="bg-gray-100 px-2 py-1 rounded-full">👥 "Which students owe money?"</span>
              </div>
            </div>
          </div>
        </div>
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
