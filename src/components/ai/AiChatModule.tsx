import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Bot, Send, User, Receipt, Sparkles, MessageCircle, Clock, Trash2, Command, Zap, ArrowUp, Mic, FileText, BarChart3, TrendingUp, Calculator, ShieldAlert } from 'lucide-react';
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
      <div className="flex items-center justify-center h-full bg-slate-50/50">
        <div className="max-w-md mx-auto text-center bg-white rounded-3xl p-10 shadow-2xl shadow-slate-200/50 border border-slate-100">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 shadow-inner">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Access Restricted</h2>
          <p className="text-slate-500 font-medium leading-relaxed">
            Only authorized administrator and finance roles can access the AI infrastructure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50/30 p-12 overflow-hidden relative">
      {/* Background Decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="max-w-3xl w-full text-center space-y-10 relative z-10">
        {/* Animated Icon Container */}
        <div className="relative inline-block group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
          <div className="relative w-32 h-32 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200 transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-500 ring-4 ring-white">
            <Bot className="w-16 h-16 text-white animate-pulse" />
          </div>
          
          <div className="absolute -top-4 -right-4 px-4 py-2 bg-amber-400 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-amber-200/50 flex items-center gap-2 animate-bounce">
            <Zap className="w-3.5 h-3.5 fill-white" />
            Beta
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Badge variant="outline" className="px-4 py-1.5 border-indigo-200 text-indigo-600 bg-indigo-50/50 rounded-full font-bold uppercase tracking-widest text-[10px]">
              Next Generation AI
            </Badge>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-slate-900 leading-tight">
              Intelligence is <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-500 bg-clip-text text-transparent">Coming Soon</span>
            </h1>
          </div>
          
          <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
            We're building a smarter, faster way to manage your school. 
            Automated reporting, natural language payments, and predictive insights are on the way.
          </p>
        </div>

        {/* Feature Grid Mockup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            { icon: <MessageCircle className="w-5 h-5" />, title: "NLP Actions", desc: "Speak to your data. Record payments by typing naturally." },
            { icon: <BarChart3 className="w-5 h-5" />, title: "Smart Reports", desc: "Instant financial audits and performance analysis." },
            { icon: <Calculator className="w-5 h-5" />, title: "AI Ledger", desc: "Automatic debt tracking and early-warning fee alerts." }
          ].map((feature, i) => (
            <div key={i} className="p-6 bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
                {feature.icon}
              </div>
              <h3 className="font-bold text-slate-800 mb-1">{feature.title}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Progress Bar Mockup */}
        <div className="pt-8 space-y-4">
          <div className="flex justify-between items-end text-sm">
            <div className="text-left">
              <p className="text-indigo-600 font-black uppercase tracking-widest text-[10px]">Neural Engine Training</p>
              <p className="text-slate-900 font-bold">Optimization Phase</p>
            </div>
            <p className="text-indigo-600 font-black">74%</p>
          </div>
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner border border-slate-200">
            <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 rounded-full animate-progress-glow w-[74%] shadow-lg shadow-indigo-100" />
          </div>
          <p className="text-xs text-slate-400 font-medium italic">
            Ensuring maximum accuracy for school financial processing...
          </p>
        </div>
      </div>
    </div>
  );
};

export default AiChatModule;
