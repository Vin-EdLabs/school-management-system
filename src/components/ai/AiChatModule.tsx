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
import { cn } from "@/lib/utils";
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
      <div className="flex items-center justify-center h-full bg-background/50 backdrop-blur-md">
        <div className="max-w-md mx-auto text-center bg-card rounded-3xl p-10 shadow-2xl border border-border/50">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shadow-inner border border-red-500/20">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-3 tracking-tight">Access Restricted</h2>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Only authorized administrator and finance roles can access the AI infrastructure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-background p-4 overflow-x-hidden overflow-y-auto relative">
      {/* Background Neural Decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[30%] w-[20%] h-[20%] bg-indigo-500/5 rounded-full blur-[80px]" />

      <div className="max-w-4xl w-full text-center space-y-2 md:space-y-4 relative z-10 animate-in fade-in zoom-in duration-700">
        {/* Animated Icon Container */}
        <div className="relative inline-block group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-700" />
          <div className="relative w-16 h-16 bg-slate-900 dark:bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 via-transparent to-purple-600/20" />
            <Bot className="w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
          </div>
          
          <div className="absolute -top-2 -right-3 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[7px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-orange-500/20 flex items-center gap-1 animate-bounce ring-4 ring-background">
            <Zap className="w-2 h-2 fill-white" />
            Beta
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 border border-indigo-500/30 text-indigo-400 bg-indigo-500/10 rounded-full font-bold uppercase tracking-widest text-[7px] backdrop-blur-md">
              <Sparkles className="w-2 h-2" />
              <span>Next Gen AI</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground leading-[1.1] font-outfit">
              Intelligence is <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Coming Soon</span>
            </h1>
          </div>
          
          <p className="text-xs md:text-sm text-muted-foreground font-medium max-w-lg mx-auto leading-relaxed">
            We're engineering a smarter way to manage your school. 
            Predictive insights are being finalized.
          </p>
        </div>

        {/* Feature Grid Mockup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {[
            { icon: <MessageCircle className="w-4 h-4" />, title: "NLP Actions", desc: "Speak to your data. Record payments by typing naturally.", color: "text-blue-400", bg: "bg-blue-500/10" },
            { icon: <BarChart3 className="w-4 h-4" />, title: "Smart Reports", desc: "Instant financial audits and performance analysis.", color: "text-purple-400", bg: "bg-purple-500/10" },
            { icon: <Calculator className="w-4 h-4" />, title: "AI Ledger", desc: "Automatic debt tracking and fee alerts.", color: "text-emerald-400", bg: "bg-emerald-500/10" }
          ].map((feature, i) => (
            <div key={i} className="p-5 bg-card/40 backdrop-blur-2xl rounded-3xl border border-border/50 hover:border-indigo-500/50 transition-all duration-500 group relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full -mr-12 -mt-12 blur-2xl" />
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3 shadow-inner border border-white/5", feature.bg, feature.color)}>
                {feature.icon}
              </div>
              <h3 className="font-bold text-foreground text-sm mb-1">{feature.title}</h3>
              <p className="text-[10px] text-muted-foreground font-medium leading-relaxed opacity-80">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Progress Bar Mockup */}
        <div className="pt-2 space-y-3 max-w-xl mx-auto">
          <div className="flex justify-between items-end">
            <div className="text-left">
              <p className="text-indigo-400 font-black uppercase tracking-widest text-[8px]">Neural Engine Training</p>
              <p className="text-foreground font-bold text-xs">Optimization Phase: Luminous Core v4.2</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-indigo-400 font-outfit">74%</span>
            </div>
          </div>
          <div className="h-4 w-full bg-muted/50 rounded-full overflow-hidden p-1 border border-border shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-full relative shadow-[0_0_15px_rgba(99,102,241,0.2)] w-[74%]"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60 font-medium italic">
            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
            Ensuring accuracy for financial processing...
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

export default AiChatModule;
