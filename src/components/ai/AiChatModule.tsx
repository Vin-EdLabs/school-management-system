
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Bot, Send, User, Receipt, DollarSign, Users, BookOpen } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  action?: 'receipt' | 'payment' | 'info' | 'balance' | 'stats' | 'search';
  data?: any;
}

interface AIResponse {
  content: string;
  action?: 'receipt' | 'payment' | 'info' | 'balance' | 'stats' | 'search';
  data?: any;
}

const AiChatModule = () => {
  const { user, hasAccess } = useAuth();
  const { students, teachers, payments, feeStructures, addPayment, classes } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Hello! I\'m your AI assistant for Rosa Gardens School. I can help you record payments, generate receipts, check student balances, get school statistics, and much more. What would you like to do today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Check access
  if (!hasAccess('ai-assistant')) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
        <p className="text-gray-600">Only Super Admin and Finance roles can access the AI Assistant.</p>
      </div>
    );
  }

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const findStudent = (query: string) => {
    const searchTerm = query.toLowerCase();
    return students.find(student => 
      student.studentId.toLowerCase().includes(searchTerm) ||
      student.firstName.toLowerCase().includes(searchTerm) ||
      student.lastName.toLowerCase().includes(searchTerm) ||
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTerm)
    );
  };

  const calculateStudentBalance = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return null;

    const currentTerm = getActiveAcademicTerm();
    const studentPayments = payments.filter(p => p.studentId === studentId);
    const feeStructure = feeStructures.find(f => f.className === student.classAssigned && f.term === currentTerm);
    
    const totalPaid = studentPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const currentTermFee = feeStructure?.amount || 0;
    const balance = Math.max(0, currentTermFee - totalPaid);
    
    return {
      student,
      totalPaid,
      currentTermFee,
      balance,
      feeStructure
    };
  };

  const generateReceiptNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RG${timestamp}${random}`;
  };

  const processUserInput = async (input: string): Promise<string | AIResponse> => {
    setIsProcessing(true);
    const lowerInput = input.toLowerCase();

    try {
      // Payment recording
      if (lowerInput.includes('record') && (lowerInput.includes('payment') || lowerInput.includes('fee'))) {
        const amountMatch = input.match(/(\d+(?:\.\d{2})?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
        
        if (!amount) {
          return 'Please specify the payment amount. Example: "Record payment of 500 for student ID STU001"';
        }

        const studentIdMatch = input.match(/(?:student\s*id|id)\s*:?\s*([A-Za-z0-9]+)/i);
        const studentNameMatch = input.match(/for\s+([A-Za-z\s]+)(?:\s+(?:amount|pay|fee))?/i);
        
        let student = null;
        if (studentIdMatch) {
          student = findStudent(studentIdMatch[1]);
        } else if (studentNameMatch) {
          student = findStudent(studentNameMatch[1].trim());
        }

        if (!student) {
          return 'Student not found. Please provide a valid student ID or name.';
        }

        // Record the payment
        const paymentData = {
          studentId: student.id,
          amount,
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'Cash',
          term: getActiveAcademicTerm(),
          notes: 'Recorded via AI Assistant'
        };

        addPayment(paymentData);

        // Generate receipt data
        const balanceInfo = calculateStudentBalance(student.id);
        const receiptNumber = generateReceiptNumber();
        
        const newReceiptData = {
          studentName: `${student.firstName} ${student.lastName}`,
          studentId: student.studentId,
          className: student.classAssigned,
          amount,
          date: paymentData.date,
          paymentMethod: paymentData.paymentMethod,
          term: paymentData.term,
          year: getActiveAcademicYear(),
          receiptNumber,
          notes: paymentData.notes,
          remainingBalance: balanceInfo ? Math.max(0, balanceInfo.currentTermFee - (balanceInfo.totalPaid + amount)) : 0
        };

        setReceiptData(newReceiptData);

        return {
          content: `✅ Payment recorded successfully!\n\n💰 Amount: GHS ${amount.toFixed(2)}\n👤 Student: ${student.firstName} ${student.lastName} (${student.studentId})\n🏫 Class: ${student.classAssigned}\n📄 Receipt: ${receiptNumber}\n\nWould you like me to show the receipt?`,
          action: 'payment',
          data: newReceiptData
        };
      }

      // Show receipt
      if (lowerInput.includes('show') && lowerInput.includes('receipt')) {
        const studentQuery = input.replace(/show|receipt|for|the/gi, '').trim();
        const student = findStudent(studentQuery);
        
        if (!student) {
          return 'Please specify which student\'s receipt you want to see.';
        }

        const lastPayment = payments
          .filter(p => p.studentId === student.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (!lastPayment) {
          return `No payment records found for ${student.firstName} ${student.lastName}.`;
        }

        const receiptNumber = generateReceiptNumber();
        const balanceInfo = calculateStudentBalance(student.id);
        
        const receiptData = {
          studentName: `${student.firstName} ${student.lastName}`,
          studentId: student.studentId,
          className: student.classAssigned,
          amount: lastPayment.amount,
          date: lastPayment.date,
          paymentMethod: lastPayment.paymentMethod,
          term: lastPayment.term,
          year: getActiveAcademicYear(),
          receiptNumber,
          notes: lastPayment.notes,
          remainingBalance: balanceInfo?.balance || 0
        };

        setReceiptData(receiptData);
        setShowReceipt(true);

        return {
          content: `📄 Receipt for ${student.firstName} ${student.lastName} is ready to view.`,
          action: 'receipt',
          data: receiptData
        };
      }

      // Student balance check
      if (lowerInput.includes('balance') || lowerInput.includes('owes') || lowerInput.includes('owe')) {
        const studentQuery = input.replace(/balance|owes|owe|check|for|what|does|how|much/gi, '').trim();
        const student = findStudent(studentQuery);
        
        if (!student) {
          return 'Please specify which student\'s balance you want to check.';
        }

        const balanceInfo = calculateStudentBalance(student.id);
        if (!balanceInfo) {
          return 'Unable to calculate balance for this student.';
        }

        return {
          content: `💰 Balance for ${student.firstName} ${student.lastName}:\n\n🏫 Class: ${student.classAssigned}\n💵 Current Term Fee: GHS ${balanceInfo.currentTermFee.toFixed(2)}\n✅ Total Paid: GHS ${balanceInfo.totalPaid.toFixed(2)}\n⚠️ Outstanding Balance: GHS ${balanceInfo.balance.toFixed(2)}\n\n${balanceInfo.balance === 0 ? '✅ Fully paid!' : '❌ Payment pending'}`,
          action: 'balance'
        };
      }

      // School statistics
      if (lowerInput.includes('total') || lowerInput.includes('number') || lowerInput.includes('how many') || lowerInput.includes('statistics') || lowerInput.includes('stats')) {
        if (lowerInput.includes('student')) {
          return {
            content: `👥 Total Students: ${students.length}\n\n📊 Breakdown by Level:\n${
              classes.reduce((acc, cls) => {
                const studentCount = students.filter(s => s.classAssigned === cls.className).length;
                if (studentCount > 0) {
                  acc += `• ${cls.className}: ${studentCount} students\n`;
                }
                return acc;
              }, '')
            }`,
            action: 'stats'
          };
        }

        if (lowerInput.includes('teacher')) {
          return {
            content: `👨‍🏫 Total Teachers: ${teachers.length}\n\n📋 Employment Status:\n• Active: ${teachers.filter(t => t.employmentStatus === 'Active').length}\n• Inactive: ${teachers.filter(t => t.employmentStatus !== 'Active').length}`,
            action: 'stats'
          };
        }

        if (lowerInput.includes('class')) {
          return {
            content: `🏫 Total Classes: ${classes.length}\n\n📚 Class Breakdown:\n${
              classes.map(cls => {
                const studentCount = students.filter(s => s.classAssigned === cls.className).length;
                return `• ${cls.className}: ${studentCount}/${cls.maxClassSize} students`;
              }).join('\n')
            }`,
            action: 'stats'
          };
        }

        // General stats
        return {
          content: `📊 Rosa Gardens School Statistics:\n\n👥 Students: ${students.length}\n👨‍🏫 Teachers: ${teachers.length}\n🏫 Classes: ${classes.length}\n💰 Total Payments This Term: GHS ${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}\n📅 Current Term: ${getActiveAcademicTerm()}`,
          action: 'stats'
        };
      }

      // Search student
      if (lowerInput.includes('find') || lowerInput.includes('search') || lowerInput.includes('student info')) {
        const query = input.replace(/find|search|student|info|for/gi, '').trim();
        const student = findStudent(query);
        
        if (!student) {
          return 'Student not found. Please check the student ID or name.';
        }

        return {
          content: `👤 Student Information:\n\n📝 Name: ${student.firstName} ${student.lastName}\n🆔 Student ID: ${student.studentId}\n🏫 Class: ${student.classAssigned}\n📞 Guardian: ${student.guardianName}\n☎️ Contact: ${student.guardianContact}\n📅 Admission Date: ${new Date(student.dateOfAdmission).toLocaleDateString()}`,
          action: 'search'
        };
      }

      // Default help response
      return {
        content: `I can help you with:

💰 **Payment Recording**: "Record payment of 500 for student ID STU001"
📄 **Receipt Generation**: "Show receipt for John Doe"
💳 **Balance Checking**: "Check balance for student ID STU001"
📊 **School Statistics**: "How many students?" or "Total teachers"
🔍 **Student Search**: "Find student John Doe"

Please let me know what you'd like to do!`,
        action: 'info'
      };

    } catch (error) {
      console.error('AI processing error:', error);
      return 'Sorry, I encountered an error processing your request. Please try again.';
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    const response = await processUserInput(inputValue);
    
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: typeof response === 'string' ? response : response.content,
      timestamp: new Date(),
      action: typeof response === 'object' ? response.action : undefined,
      data: typeof response === 'object' ? response.data : undefined
    };

    setMessages(prev => [...prev, aiMessage]);

    if (typeof response === 'object' && response.action === 'payment') {
      toast({
        title: "Payment Recorded",
        description: "Payment has been successfully recorded and receipt generated.",
      });
    }
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

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI School Assistant</h1>
                <p className="text-gray-600">Smart database interactions and school management</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {user?.role === 'super-admin' ? 'Super Admin' : 'Finance'} Access
            </Badge>
          </div>
        </div>

        <Card className="h-[70vh] flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2">
              <Bot className="w-5 h-5" />
              <span>Chat Assistant</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <div className="flex items-start space-x-2">
                        {message.type === 'ai' && <Bot className="w-4 h-4 mt-1 flex-shrink-0" />}
                        {message.type === 'user' && <User className="w-4 h-4 mt-1 flex-shrink-0" />}
                        <div className="flex-1">
                          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                          {message.action === 'receipt' && message.data && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShowReceipt(message.data)}
                              className="mt-2 text-blue-600 hover:text-blue-700"
                            >
                              <Receipt className="w-4 h-4 mr-1" />
                              View Receipt
                            </Button>
                          )}
                          {message.action === 'payment' && message.data && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShowReceipt(message.data)}
                              className="mt-2 text-green-600 hover:text-green-700"
                            >
                              <Receipt className="w-4 h-4 mr-1" />
                              Show Receipt
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4 animate-pulse" />
                        <div className="text-sm text-gray-600">AI is thinking...</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="mt-4 flex space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about the school, record payments, generate receipts..."
                className="flex-1"
                disabled={isProcessing}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputValue.trim() || isProcessing}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Try: "Record payment of 500 for student STU001" • "Show receipt for John Doe" • "How many students?"
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
