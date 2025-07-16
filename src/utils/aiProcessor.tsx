import { generateReceiptNumber, getActiveAcademicTerm, getActiveAcademicYear } from './feeCalculations';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  classAssigned: string;
  guardianName: string;
  guardianContact: string;
  dateOfAdmission: string;
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  paymentMethod: string;
  term: string;
  notes: string;
}

interface Income {
  id: string;
  source: string;
  amount: number;
  date: string;
  description: string;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  paymentDate: string;
  description: string;
  paymentMethod: string;
}

interface FeeStructure {
  id: string;
  className: string;
  term: string;
  amount: number;
}

interface AIProcessorData {
  students: Student[];
  teachers: any[];
  payments: Payment[];
  feeStructures: FeeStructure[];
  classes: any[];
  income: Income[];
  expenses: Expense[];
  addPayment: (payment: any) => void;
}

export interface AIResponse {
  content: string;
  action?: 'receipt' | 'payment' | 'info' | 'balance' | 'stats' | 'search' | 'list' | 'report';
  data?: any;
}

export class AIProcessor {
  private data: AIProcessorData;

  constructor(data: AIProcessorData) {
    this.data = data;
  }

  async processInput(input: string): Promise<string | AIResponse> {
    const lowerInput = input.toLowerCase();

    try {
      // General reports
      if (this.matchesPattern(lowerInput, ['general', 'report']) || 
          this.matchesPattern(lowerInput, ['complete', 'report']) ||
          this.matchesPattern(lowerInput, ['financial', 'summary'])) {
        return this.handleGeneralReport();
      }

      // Income and expenses summaries
      if (this.matchesPattern(lowerInput, ['income', 'summary']) || 
          this.matchesPattern(lowerInput, ['total', 'income'])) {
        return this.handleIncomeSummary();
      }

      if (this.matchesPattern(lowerInput, ['expenses', 'summary']) || 
          this.matchesPattern(lowerInput, ['total', 'expenses'])) {
        return this.handleExpensesSummary();
      }

      // Payment recording
      if (this.matchesPattern(lowerInput, ['record', 'payment']) || 
          this.matchesPattern(lowerInput, ['pay', 'fee'])) {
        return this.handlePaymentRecording(input);
      }

      // Receipt operations
      if (this.matchesPattern(lowerInput, ['receipt', 'show']) || 
          this.matchesPattern(lowerInput, ['receipt', 'print'])) {
        return this.handleReceiptRequest(input);
      }

      // Balance and debt checking
      if (this.matchesPattern(lowerInput, ['balance']) || 
          this.matchesPattern(lowerInput, ['owe', 'debt']) ||
          this.matchesPattern(lowerInput, ['outstanding'])) {
        return this.handleBalanceRequest(input);
      }

      // List students with various filters
      if (this.matchesPattern(lowerInput, ['list', 'students']) ||
          this.matchesPattern(lowerInput, ['all', 'students']) ||
          this.matchesPattern(lowerInput, ['students', 'who'])) {
        return this.handleStudentListRequest(input);
      }

      // Statistics and numbers
      if (this.matchesPattern(lowerInput, ['how', 'many']) ||
          this.matchesPattern(lowerInput, ['number', 'of']) ||
          this.matchesPattern(lowerInput, ['total']) ||
          this.matchesPattern(lowerInput, ['statistics'])) {
        return this.handleStatisticsRequest(input);
      }

      // Student search
      if (this.matchesPattern(lowerInput, ['find', 'student']) ||
          this.matchesPattern(lowerInput, ['search']) ||
          this.matchesPattern(lowerInput, ['student', 'info'])) {
        return this.handleStudentSearch(input);
      }

      // Default help
      return this.getHelpResponse();

    } catch (error) {
      console.error('AI processing error:', error);
      return 'Sorry, I encountered an error processing your request. Please try again or rephrase your question.';
    }
  }

  private matchesPattern(input: string, keywords: string[]): boolean {
    return keywords.every(keyword => input.includes(keyword));
  }

  private findStudent(query: string): Student | undefined {
    const searchTerm = query.toLowerCase().trim();
    console.log('🔍 Searching for student with query:', searchTerm);
    console.log('📋 Available students:', this.data.students.map(s => ({ 
      id: s.studentId, 
      name: `${s.firstName} ${s.lastName}` 
    })));
    
    // Multiple search strategies for better matching
    const student = this.data.students.find(student => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      const reverseName = `${student.lastName} ${student.firstName}`.toLowerCase();
      const studentIdLower = student.studentId.toLowerCase();
      
      const matches = 
        // Exact matches
        studentIdLower === searchTerm ||
        fullName === searchTerm ||
        reverseName === searchTerm ||
        // Partial matches
        studentIdLower.includes(searchTerm) ||
        searchTerm.includes(studentIdLower) ||
        fullName.includes(searchTerm) ||
        searchTerm.includes(fullName) ||
        // Individual name matches
        student.firstName.toLowerCase().includes(searchTerm) ||
        student.lastName.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(student.firstName.toLowerCase()) ||
        searchTerm.includes(student.lastName.toLowerCase());
      
      if (matches) {
        console.log(`✅ Found match: ${student.firstName} ${student.lastName} (${student.studentId})`);
      }
      return matches;
    });

    if (!student) {
      console.log('❌ No student found for query:', searchTerm);
    }
    
    return student;
  }

  private calculateStudentBalance(studentId: string) {
    const student = this.data.students.find(s => s.id === studentId);
    if (!student) return null;

    const currentTerm = getActiveAcademicTerm();
    const studentPayments = this.data.payments.filter(p => p.studentId === studentId);
    const feeStructure = this.data.feeStructures.find(f => f.className === student.classAssigned && f.term === currentTerm);
    
    const totalPaid = studentPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const currentTermFee = feeStructure?.amount || 0;
    const balance = Math.max(0, currentTermFee - totalPaid);
    
    return {
      student,
      totalPaid,
      currentTermFee,
      balance,
      feeStructure,
      payments: studentPayments
    };
  }

  private handleGeneralReport(): AIResponse {
    const currentTerm = getActiveAcademicTerm();
    const currentYear = getActiveAcademicYear();
    
    // Calculate financial totals
    const totalFees = this.data.payments
      .filter(p => p.term === currentTerm)
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalIncome = this.data.income
      .filter(inc => new Date(inc.date).getFullYear().toString() === currentYear)
      .reduce((sum, inc) => sum + inc.amount, 0);
    
    const totalExpenses = this.data.expenses
      .filter(exp => new Date(exp.paymentDate).getFullYear().toString() === currentYear)
      .reduce((sum, exp) => sum + exp.amount, 0);
    
    const totalRevenue = totalFees + totalIncome;
    const netProfit = totalRevenue - totalExpenses;
    
    // Calculate student statistics
    const totalStudents = this.data.students.length;
    const studentsWithBalance = this.data.students.filter(student => {
      const balance = this.calculateStudentBalance(student.id);
      return balance && balance.balance > 0;
    });
    
    const totalOutstanding = studentsWithBalance.reduce((sum, student) => {
      const balance = this.calculateStudentBalance(student.id);
      return sum + (balance?.balance || 0);
    }, 0);

    // Class breakdown
    const classBreakdown = this.data.classes.map(cls => {
      const studentsInClass = this.data.students.filter(s => s.classAssigned === cls.className);
      const classPayments = this.data.payments.filter(p => {
        const student = this.data.students.find(s => s.id === p.studentId);
        return student && student.classAssigned === cls.className && p.term === currentTerm;
      }).reduce((sum, p) => sum + p.amount, 0);
      
      return {
        className: cls.className,
        enrolled: studentsInClass.length,
        capacity: cls.maxClassSize || 0,
        feesCollected: classPayments
      };
    });

    // Top expenses categories
    const expenseCategories = this.data.expenses
      .filter(exp => new Date(exp.paymentDate).getFullYear().toString() === currentYear)
      .reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);

    const reportContent = `📊 **ROSA GARDENS SCHOOL - GENERAL REPORT**
**Academic Term:** ${currentTerm}
**Generated on:** ${new Date().toLocaleDateString()}

---

## 💰 **FINANCIAL SUMMARY**
• **Total Fees Collected:** GHS ${totalFees.toLocaleString()}
• **Other Income:** GHS ${totalIncome.toLocaleString()}
• **Total Revenue:** GHS ${totalRevenue.toLocaleString()}
• **Total Expenses:** GHS ${totalExpenses.toLocaleString()}
• **Net Profit/Loss:** GHS ${netProfit.toLocaleString()} ${netProfit >= 0 ? '✅' : '❌'}

---

## 👥 **STUDENT STATISTICS**
• **Total Students:** ${totalStudents}
• **Students with Outstanding Balance:** ${studentsWithBalance.length}
• **Total Outstanding Amount:** GHS ${totalOutstanding.toLocaleString()}
• **Collection Rate:** ${((totalFees / (totalFees + totalOutstanding)) * 100).toFixed(1)}%

---

## 🏫 **CLASS BREAKDOWN**
${classBreakdown.map(cls => 
  `• **${cls.className}:** ${cls.enrolled}/${cls.capacity} students - GHS ${cls.feesCollected.toLocaleString()} collected`
).join('\n')}

---

## 💸 **TOP EXPENSE CATEGORIES**
${Object.entries(expenseCategories)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([category, amount]) => `• **${category}:** GHS ${amount.toLocaleString()}`)
  .join('\n')}

---

**Report Summary:** This comprehensive report shows the school's financial health for ${currentTerm}. ${netProfit >= 0 ? 'The school is operating profitably.' : 'The school needs to review expenses or increase revenue.'}`;

    const reportData = {
      reportType: 'General Financial Report',
      term: currentTerm,
      year: currentYear,
      date: new Date().toISOString(),
      financial: {
        totalFees,
        totalIncome,
        totalRevenue,
        totalExpenses,
        netProfit
      },
      students: {
        total: totalStudents,
        owing: studentsWithBalance.length,
        totalOutstanding
      },
      classes: classBreakdown,
      expenses: expenseCategories
    };

    return {
      content: reportContent,
      action: 'report',
      data: reportData
    };
  }

  private handleIncomeSummary(): AIResponse {
    const currentYear = getActiveAcademicYear();
    const currentTerm = getActiveAcademicTerm();
    
    const feeIncome = this.data.payments
      .filter(p => p.term === currentTerm)
      .reduce((sum, p) => sum + p.amount, 0);
    
    const otherIncome = this.data.income
      .filter(inc => new Date(inc.date).getFullYear().toString() === currentYear)
      .reduce((sum, inc) => sum + inc.amount, 0);
    
    const incomeBreakdown = this.data.income
      .filter(inc => new Date(inc.date).getFullYear().toString() === currentYear)
      .reduce((acc, income) => {
        acc[income.source] = (acc[income.source] || 0) + income.amount;
        return acc;
      }, {} as Record<string, number>);

    const content = `💹 **INCOME SUMMARY - ${currentTerm}**

## 💰 **TOTAL INCOME BREAKDOWN**
• **School Fees:** GHS ${feeIncome.toLocaleString()}
• **Other Income:** GHS ${otherIncome.toLocaleString()}
• **Grand Total:** GHS ${(feeIncome + otherIncome).toLocaleString()}

## 📋 **OTHER INCOME SOURCES**
${Object.entries(incomeBreakdown)
  .sort(([,a], [,b]) => b - a)
  .map(([source, amount]) => `• **${source}:** GHS ${amount.toLocaleString()}`)
  .join('\n') || '• No other income recorded'}

---
**Summary:** School fees represent ${((feeIncome / (feeIncome + otherIncome)) * 100).toFixed(1)}% of total income.`;

    return {
      content,
      action: 'report',
      data: { type: 'income', feeIncome, otherIncome, breakdown: incomeBreakdown }
    };
  }

  private handleExpensesSummary(): AIResponse {
    const currentYear = getActiveAcademicYear();
    
    const totalExpenses = this.data.expenses
      .filter(exp => new Date(exp.paymentDate).getFullYear().toString() === currentYear)
      .reduce((sum, exp) => sum + exp.amount, 0);
    
    const expensesByCategory = this.data.expenses
      .filter(exp => new Date(exp.paymentDate).getFullYear().toString() === currentYear)
      .reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);

    const expensesByMonth = this.data.expenses
      .filter(exp => new Date(exp.paymentDate).getFullYear().toString() === currentYear)
      .reduce((acc, expense) => {
        const month = new Date(expense.paymentDate).toLocaleDateString('en', { month: 'long' });
        acc[month] = (acc[month] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);

    const content = `💸 **EXPENSES SUMMARY - ${currentYear}**

## 💳 **TOTAL EXPENSES**
• **Grand Total:** GHS ${totalExpenses.toLocaleString()}
• **Average Monthly:** GHS ${(totalExpenses / 12).toLocaleString()}

## 📊 **BY CATEGORY**
${Object.entries(expensesByCategory)
  .sort(([,a], [,b]) => b - a)
  .map(([category, amount]) => `• **${category}:** GHS ${amount.toLocaleString()} (${((amount / totalExpenses) * 100).toFixed(1)}%)`)
  .join('\n')}

## 📅 **BY MONTH**
${Object.entries(expensesByMonth)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 6)
  .map(([month, amount]) => `• **${month}:** GHS ${amount.toLocaleString()}`)
  .join('\n')}`;

    return {
      content,
      action: 'report',
      data: { type: 'expenses', total: totalExpenses, byCategory: expensesByCategory, byMonth: expensesByMonth }
    };
  }

  private handlePaymentRecording(input: string): AIResponse | string {
    const amountMatch = input.match(/(\d+(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    
    if (!amount) {
      return 'Please specify the payment amount. Example: "Record payment of 500 for student ID 20240001"';
    }

    const studentIdMatch = input.match(/(?:student\s*id|id)\s*:?\s*([A-Za-z0-9]+)/i) ||
                          input.match(/(?:for|student)\s+([A-Za-z0-9\s]+)(?:\s+amount|\s*$)/i);
    
    let student = null;
    let searchQuery = '';
    
    if (studentIdMatch) {
      searchQuery = studentIdMatch[1].trim();
      student = this.findStudent(searchQuery);
    }

    if (!student) {
      const availableStudents = this.data.students.slice(0, 5).map(s => 
        `${s.firstName} ${s.lastName} (ID: ${s.studentId})`
      ).join('\n');
      
      return `❌ Student "${searchQuery}" not found. Please check the student ID or name.

**Available students:**
${availableStudents}

**Try:** "Record payment of ${amount} for student ${this.data.students[0]?.studentId || '20240001'}"`;
    }

    const paymentData = {
      studentId: student.id,
      amount,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      term: getActiveAcademicTerm(),
      notes: 'Recorded via AI Assistant'
    };

    this.data.addPayment(paymentData);

    const balanceInfo = this.calculateStudentBalance(student.id);
    const receiptNumber = generateReceiptNumber();
    
    const receiptData = {
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

    return {
      content: `✅ **Payment recorded successfully!**

💰 **Amount:** GHS ${amount.toFixed(2)}
👤 **Student:** ${student.firstName} ${student.lastName} (${student.studentId})
🏫 **Class:** ${student.classAssigned}
📄 **Receipt:** ${receiptNumber}
💳 **Remaining Balance:** GHS ${receiptData.remainingBalance.toFixed(2)}`,
      action: 'payment',
      data: receiptData
    };
  }

  private handleReceiptRequest(input: string): AIResponse | string {
    const studentQuery = input.replace(/show|receipt|print|for|the/gi, '').trim();
    const student = this.findStudent(studentQuery);
    
    if (!student) {
      return '❌ Please specify which student\'s receipt you want to see. Try "Show receipt for John Doe" or "Receipt for student ID 20240001"';
    }

    const lastPayment = this.data.payments
      .filter(p => p.studentId === student.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!lastPayment) {
      return `❌ No payment records found for ${student.firstName} ${student.lastName}.`;
    }

    const balanceInfo = this.calculateStudentBalance(student.id);
    const receiptData = {
      studentName: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      className: student.classAssigned,
      amount: lastPayment.amount,
      date: lastPayment.date,
      paymentMethod: lastPayment.paymentMethod,
      term: lastPayment.term,
      year: getActiveAcademicYear(),
      receiptNumber: generateReceiptNumber(),
      notes: lastPayment.notes,
      remainingBalance: balanceInfo?.balance || 0
    };

    return {
      content: `📄 **Latest receipt for ${student.firstName} ${student.lastName}** is ready to view.

💰 **Amount:** GHS ${lastPayment.amount.toFixed(2)}
📅 **Date:** ${new Date(lastPayment.date).toLocaleDateString()}
💳 **Remaining Balance:** GHS ${receiptData.remainingBalance.toFixed(2)}`,
      action: 'receipt',
      data: receiptData
    };
  }

  private handleBalanceRequest(input: string): AIResponse | string {
    if (input.includes('all') || input.includes('students') || input.includes('who')) {
      return this.getStudentsOwing();
    }

    const studentQuery = input.replace(/balance|owes|owe|check|for|what|does|how|much|outstanding|debt/gi, '').trim();
    const student = this.findStudent(studentQuery);
    
    if (!student) {
      return '❌ Please specify which student\'s balance you want to check, or ask "Which students owe money?"';
    }

    const balanceInfo = this.calculateStudentBalance(student.id);
    if (!balanceInfo) {
      return '❌ Unable to calculate balance for this student.';
    }

    return {
      content: `💰 **Balance for ${student.firstName} ${student.lastName}:**

🏫 **Class:** ${student.classAssigned}
💵 **Current Term Fee:** GHS ${balanceInfo.currentTermFee.toFixed(2)}
✅ **Total Paid:** GHS ${balanceInfo.totalPaid.toFixed(2)}
⚠️ **Outstanding Balance:** GHS ${balanceInfo.balance.toFixed(2)}
📊 **Payment History:** ${balanceInfo.payments.length} payments

${balanceInfo.balance === 0 ? '✅ **Fully paid!**' : '❌ **Payment pending**'}`,
      action: 'balance',
      data: balanceInfo
    };
  }

  private getStudentsOwing(): AIResponse {
    const studentsWithBalance = this.data.students
      .map(student => {
        const balanceInfo = this.calculateStudentBalance(student.id);
        return { student, balance: balanceInfo?.balance || 0 };
      })
      .filter(item => item.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    if (studentsWithBalance.length === 0) {
      return {
        content: '🎉 **Great news!** All students have paid their fees in full!',
        action: 'stats'
      };
    }

    const totalOwing = studentsWithBalance.reduce((sum, item) => sum + item.balance, 0);
    const studentsText = studentsWithBalance.slice(0, 10).map((item, index) => 
      `${index + 1}. **${item.student.firstName} ${item.student.lastName}** (${item.student.studentId}) - GHS ${item.balance.toFixed(2)}`
    ).join('\n');

    const moreText = studentsWithBalance.length > 10 ? `\n... and ${studentsWithBalance.length - 10} more students` : '';

    return {
      content: `💸 **Students with outstanding balances:**

${studentsText}${moreText}

📊 **Total Students Owing:** ${studentsWithBalance.length}
💰 **Total Amount Owing:** GHS ${totalOwing.toFixed(2)}`,
      action: 'list',
      data: studentsWithBalance
    };
  }

  private handleStudentListRequest(input: string): AIResponse | string {
    if (input.includes('class') || input.includes('grade')) {
      const classMatch = input.match(/class\s+([A-Za-z0-9\s\(\)]+)/i) || input.match(/grade\s+([A-Za-z0-9\s\(\)]+)/i);
      if (classMatch) {
        return this.getStudentsByClass(classMatch[1].trim());
      }
    }

    const studentsText = this.data.students
      .sort((a, b) => a.firstName.localeCompare(b.firstName))
      .map((student, index) => 
        `${index + 1}. **${student.firstName} ${student.lastName}** (${student.studentId}) - ${student.classAssigned}`
      ).join('\n');

    return {
      content: `👥 **All Students (${this.data.students.length}):**

${studentsText}`,
      action: 'list',
      data: this.data.students
    };
  }

  private getStudentsByClass(className: string): AIResponse {
    const studentsInClass = this.data.students.filter(student => 
      student.classAssigned.toLowerCase().includes(className.toLowerCase())
    );

    if (studentsInClass.length === 0) {
      return {
        content: `❌ No students found in class "${className}". Please check the class name.`,
        action: 'info'
      };
    }

    const studentsText = studentsInClass.map((student, index) => 
      `${index + 1}. **${student.firstName} ${student.lastName}** (${student.studentId})`
    ).join('\n');

    return {
      content: `👥 **Students in ${className} (${studentsInClass.length}):**

${studentsText}`,
      action: 'list',
      data: studentsInClass
    };
  }

  private handleStatisticsRequest(input: string): AIResponse {
    const totalPaid = this.data.payments.reduce((sum, p) => sum + p.amount, 0);
    const studentsOwing = this.data.students.filter(s => {
      const balance = this.calculateStudentBalance(s.id);
      return balance && balance.balance > 0;
    }).length;

    return {
      content: `📊 **Rosa Gardens School Statistics:**

👥 **Students:** ${this.data.students.length}
👨‍🏫 **Teachers:** ${this.data.teachers.length}
🏫 **Classes:** ${this.data.classes.length}
💰 **Total Payments:** GHS ${totalPaid.toFixed(2)}
📊 **Students Owing:** ${studentsOwing}
📅 **Current Term:** ${getActiveAcademicTerm()}`,
      action: 'stats'
    };
  }

  private handleStudentSearch(input: string): AIResponse | string {
    const query = input.replace(/find|search|student|info|for|show|me/gi, '').trim();
    const student = this.findStudent(query);
    
    if (!student) {
      return '❌ Student not found. Please check the student ID or name. Try "Find student John Doe" or "Search for 20240001"';
    }

    const balanceInfo = this.calculateStudentBalance(student.id);
    const paymentCount = this.data.payments.filter(p => p.studentId === student.id).length;

    return {
      content: `👤 **Student Information:**

📝 **Name:** ${student.firstName} ${student.lastName}
🆔 **Student ID:** ${student.studentId}
🏫 **Class:** ${student.classAssigned}
📞 **Guardian:** ${student.guardianName}
☎️ **Contact:** ${student.guardianContact}
📅 **Admission:** ${new Date(student.dateOfAdmission).toLocaleDateString()}
💰 **Balance:** GHS ${balanceInfo?.balance.toFixed(2) || '0.00'}
📊 **Payments Made:** ${paymentCount}`,
      action: 'search',
      data: { student, balanceInfo }
    };
  }

  private getHelpResponse(): AIResponse {
    return {
      content: `🤖 **I can help you with many tasks! Here are some examples:**

💰 **Payments:**
• "Record payment of 500 for student 20240001"
• "Payment of 300 for John Doe"

📄 **Receipts:**
• "Show receipt for Mary Smith"
• "Receipt for student 20240002"

💳 **Balances:**
• "Check balance for John Doe"
• "Which students owe money?"

👥 **Student Information:**
• "List all students"
• "Find student John Doe"

📊 **Reports & Analytics:**
• "Generate general report for current term"
• "Show income summary"
• "Show expenses summary"

Just ask me naturally - I'll understand! 😊`,
      action: 'info'
    };
  }
}
