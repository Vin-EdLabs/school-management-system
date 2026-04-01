import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Bot, Send, User, Receipt, Sparkles, MessageCircle, Clock, Trash2, Command, Zap, ArrowUp, Mic, FileText, BarChart3, TrendingUp, Calculator } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { useChatPersistence } from '../../hooks/useChatPersistence';
import { AIProcessor } from '../../utils/aiProcessor';
import A4ReportPrinter from '../reports/A4ReportPrinter';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  action?: 'receipt' | 'payment' | 'info' | 'balance' | 'stats' | 'search' | 'list' | 'report';
  data?: any;
  isTyping?: boolean;
}

interface QuickCommand {
  id: string;
  icon: string;
  title: string;
  description: string;
  template: string;
  category: string;
}

const quickCommands: QuickCommand[] = [
  {
    id: 'record-payment',
    icon: '💰',
    title: 'Record Payment',
    description: 'Record payment for student',
    template: 'Record payment ₵[AMOUNT] for student [ID]',
    category: 'Payments'
  },
  {
    id: 'check-balance',
    icon: '💳',
    title: 'Check Balance',
    description: 'Check student balance',
    template: 'Check balance for student [ID]',
    category: 'Balances'
  },
  {
    id: 'show-receipt',
    icon: '📄',
    title: 'Show Receipt',
    description: 'Show latest receipt',
    template: 'Show receipt for student [ID]',
    category: 'Receipts'
  },
  {
    id: 'students-owing',
    icon: '⚠️',
    title: 'Students Owing',
    description: 'List students with debt',
    template: 'Which students owe money?',
    category: 'Reports'
  },
  {
    id: 'all-students',
    icon: '👥',
    title: 'All Students',
    description: 'List all students',
    template: 'List all students',
    category: 'Students'
  },
  {
    id: 'general-report',
    icon: '📊',
    title: 'General Report',
    description: 'Complete financial report',
    template: 'Generate general report for current term',
    category: 'Reports'
  },
  {
    id: 'income-summary',
    icon: '💹',
    title: 'Income Summary',
    description: 'Total income breakdown',
    template: 'Show income summary',
    category: 'Reports'
  },
  {
    id: 'expenses-summary',
    icon: '💸',
    title: 'Expenses Summary',
    description: 'Total expenses breakdown',
    template: 'Show expenses summary',
    category: 'Reports'
  }
];

const TypingMessage = () => (
  <div className="flex justify-start mb-4">
    <div className="max-w-[80%] bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center space-x-1 pt-1">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-sm text-gray-600 ml-2">AI is thinking...</span>
        </div>
      </div>
    </div>
  </div>
);

const AiChatModule = () => {
  const { user, hasAccess } = useAuth();
  const { students, teachers, payments, feeStructures, addPayment, classes, income, expenses } = useData();
  const { messages, addMessage, clearMessages } = useChatPersistence();
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [showCommands, setShowCommands] = useState(true);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [showA4Report, setShowA4Report] = useState(false);
  const [reportData, setReportData] = useState(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!hasAccess('ai-assistant')) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md mx-auto text-center bg-white rounded-2xl p-8 shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Bot className="w-8 h-8 text-gray-400" />
          </div>
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
  }, [messages, typingMessageId]);

  const processUserInput = async (input: string): Promise<void> => {
    setIsProcessing(true);
    
    const typingId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setTypingMessageId(typingId);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const processor = new AIProcessor({
        students,
        teachers,
        payments,
        feeStructures,
        classes,
        income: income as any[],
        expenses: expenses as any[],
        addPayment
      });

      const response = await processor.processInput(input);
      
      setTypingMessageId(null);
      
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
      setTypingMessageId(null);
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

  const handleQuickCommand = async (template: string) => {
    if (template.includes('[')) {
      setInputValue(template);
      inputRef.current?.focus();
    } else {
      const userMessage: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type: 'user',
        content: template,
        timestamp: new Date()
      };

      addMessage(userMessage);
      await processUserInput(template);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isProcessing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleShowReceipt = (data: any) => {
    console.log('handleShowReceipt called with:', data);
    
    if (data && (data.type === 'general' || data.type === 'income' || data.type === 'expenses')) {
      console.log('Opening A4 Report for type:', data.type);
      setReportData(data);
      setShowA4Report(true);
    } 
    else if (data && data.studentName && data.amount !== undefined) {
      console.log('Opening Receipt Printer');
      setReceiptData(data);
      setShowReceipt(true);
    }
    else if (data && (data.receiptNumber || data.paymentMethod)) {
      console.log('Opening Receipt Printer (fallback)');
      setReceiptData(data);
      setShowReceipt(true);
    }
    else if (data && (data.financial || data.students || data.classes)) {
      console.log('Opening A4 Report (comprehensive data detected)');
      setReportData(data);
      setShowA4Report(true);
    }
    else {
      console.log('Unknown data format:', data);
      toast({
        title: "Unable to Display",
        description: "The data format is not recognized for display.",
        variant: "destructive"
      });
    }
  };

  const handleClearChat = () => {
    clearMessages();
    toast({
      title: "Chat Cleared",
      description: "Chat history has been cleared.",
    });
  };

  return (
    <>
      <div className="h-full flex flex-col bg-white">
        {/* Fixed Chat Header */}
        <div className="flex-shrink-0 p-6 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 via-blue-600 to-blue-700 rounded-2xl text-white shadow-lg shadow-blue-200/50">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">AI Assistant</h1>
                <p className="text-sm text-gray-500 font-medium">Empowered by TECHNERVE</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-100 px-3 py-1.5 font-semibold">
                <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                {messages.length - 1} messages
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors duration-200"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-hidden bg-slate-50/30">
          <ScrollArea className="h-full p-6" ref={scrollAreaRef}>
            <div className="max-w-4xl mx-auto space-y-6 pb-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${
                    message.type === 'user' 
                      ? 'bg-white shadow-sm border border-gray-100' 
                      : 'bg-white border border-indigo-100 shadow-md shadow-indigo-100/20'
                  } rounded-2xl p-5 transition-all duration-300 hover:shadow-lg`}>
                    
                    <div className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                        message.type === 'user' 
                          ? 'bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100' 
                          : 'bg-gradient-to-br from-indigo-500 to-blue-600'
                      }`}>
                        {message.type === 'ai' ? (
                          <Bot className="w-5 h-5 text-white" />
                        ) : (
                          <User className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div 
                          className="text-[15px] leading-relaxed prose prose-sm max-w-none text-gray-800"
                          dangerouslySetInnerHTML={{ 
                            __html: message.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                              .replace(/\n/g, '<br />') 
                          }}
                        />
                        
                        {(message.action === 'receipt' || message.action === 'payment' || message.action === 'report') && message.data && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowReceipt(message.data)}
                            className={`mt-4 ${
                              message.type === 'user' 
                                ? 'border-indigo-100 text-indigo-600 hover:bg-indigo-50' 
                                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                            } rounded-xl px-4 font-semibold transition-all duration-200`}
                          >
                            {message.action === 'report' ? (
                              <>
                                <FileText className="w-4 h-4 mr-2" />
                                View Analysis Report
                              </>
                            ) : (
                              <>
                                <Receipt className="w-4 h-4 mr-2" />
                                View Digital Receipt
                              </>
                            )}
                          </Button>
                        )}
                        
                        <div className={`text-[11px] font-medium mt-3 ${
                          message.type === 'user' ? 'text-gray-400' : 'text-indigo-400'
                        }`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {typingMessageId && <TypingMessage />}
            </div>
          </ScrollArea>
        </div>

        {/* Fixed Input Area */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
          {/* Quick Commands */}
          {showCommands && (
            <div className="px-6 py-4 overflow-x-auto scrollbar-hide bg-gray-50/50 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 mb-3 flex items-center uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 mr-2 text-amber-500 fill-amber-500" />
                Smart Recommendations
              </h3>
              <div className="flex gap-3 min-w-max pb-1">
                {quickCommands.map((command) => (
                  <Button
                    key={command.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickCommand(command.template)}
                    className="h-auto py-2.5 px-4 bg-white border border-gray-200 flex items-center gap-2.5 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 rounded-xl group"
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform">{command.icon}</span>
                    <div className="text-left">
                      <div className="text-xs font-bold leading-tight">{command.title}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommands(!showCommands)}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 rounded-xl"
              >
                <Command className="w-4 h-4 mr-2" />
                {showCommands ? 'Hide' : 'Show'} Commands
              </Button>
              <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <Clock className="w-3 h-3 mr-1" />
                Auto-clear in 10min
              </Badge>
            </div>
            
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a command, e.g. 'Record payment ₵500 for 12345' or 'Generate general report'"
                  className="pr-12 min-h-[52px] text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl shadow-sm"
                  disabled={isProcessing}
                />
              </div>
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputValue.trim() || isProcessing}
                className="h-[52px] w-[52px] p-0 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <ArrowUp className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-[52px] w-[52px] p-0 border-gray-300 hover:bg-gray-50 rounded-xl"
                disabled={isProcessing}
              >
                <Mic className="w-5 h-5 text-gray-500" />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button 
                onClick={() => handleQuickCommand('Record payment ₵500 for student 12345')}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors duration-200"
              >
                💡 Record payment ₵500 for student 12345
              </button>
              <button 
                onClick={() => handleQuickCommand('Generate general report for current term')}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors duration-200"
              >
                📊 Generate general report for current term
              </button>
              <button 
                onClick={() => handleQuickCommand('Which students owe money?')}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors duration-200"
              >
                👥 Which students owe money?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Printer */}
      {receiptData && (
        <ReceiptPrinter
          receiptData={receiptData}
          show={showReceipt}
          onClose={() => setShowReceipt(false)}
          onPrint={() => {
            toast({
              title: "Receipt Printed",
              description: "Receipt has been printed successfully",
            });
          }}
        />
      )}

      {/* A4 Report Printer */}
      {reportData && (
        <A4ReportPrinter
          reportData={reportData}
          show={showA4Report}
          onClose={() => setShowA4Report(false)}
          onPrint={() => {
            toast({
              title: "Report Generated",
              description: "Report has been generated successfully",
            });
          }}
        />
      )}
    </>
  );
};

export default AiChatModule;
