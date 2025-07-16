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
  addPayment: (payment: any) => void;
}

export interface AIResponse {
  content: string;
  action?: 'receipt' | 'payment' | 'info' | 'balance' | 'stats' | 'search' | 'list';
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

      // All receipts for a student
      if (this.matchesPattern(lowerInput, ['all', 'receipts']) || 
          this.matchesPattern(lowerInput, ['receipts', 'for'])) {
        return this.handleAllReceiptsRequest(input);
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

      // Class information
      if (this.matchesPattern(lowerInput, ['class', 'info']) ||
          this.matchesPattern(lowerInput, ['students', 'in'])) {
        return this.handleClassInfo(input);
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
    console.log('Searching for student with query:', searchTerm);
    console.log('Available students:', this.data.students.map(s => ({ id: s.studentId, name: `${s.firstName} ${s.lastName}` })));
    
    return this.data.students.find(student => {
      const matches = 
        student.studentId.toLowerCase() === searchTerm ||
        student.studentId.toLowerCase().includes(searchTerm) ||
        student.firstName.toLowerCase().includes(searchTerm) ||
        student.lastName.toLowerCase().includes(searchTerm) ||
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTerm) ||
        `${student.firstName.toLowerCase()} ${student.lastName.toLowerCase()}` === searchTerm;
      
      console.log(`Checking student ${student.firstName} ${student.lastName} (${student.studentId}):`, matches);
      return matches;
    });
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

  private handlePaymentRecording(input: string): AIResponse | string {
    const amountMatch = input.match(/(\d+(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    
    if (!amount) {
      return 'Please specify the payment amount. Example: "Record payment of 500 for student ID 20240001"';
    }

    // Enhanced student search patterns
    const studentIdMatch = input.match(/(?:student\s*id|id)\s*:?\s*([A-Za-z0-9]+)/i) ||
                          input.match(/(?:for|student)\s+([A-Za-z0-9]+)$/i);
    const studentNameMatch = input.match(/for\s+([A-Za-z\s]+)(?:\s+(?:amount|pay|fee))?/i);
    
    let student = null;
    let searchQuery = '';
    
    if (studentIdMatch) {
      searchQuery = studentIdMatch[1];
      student = this.findStudent(searchQuery);
    } else if (studentNameMatch) {
      searchQuery = studentNameMatch[1].trim();
      student = this.findStudent(searchQuery);
    }

    if (!student) {
      const availableStudents = this.data.students.slice(0, 5).map(s => 
        `${s.firstName} ${s.lastName} (ID: ${s.studentId})`
      ).join('\n');
      
      return `Student "${searchQuery}" not found. Please check the student ID or name.\n\nAvailable students:\n${availableStudents}\n\nTry: "Record payment of ${amount} for student ${this.data.students[0]?.studentId || '20240001'}"`;
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

    this.data.addPayment(paymentData);

    // Generate receipt data
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
      content: `✅ Payment recorded successfully!\n\n💰 **Amount:** GHS ${amount.toFixed(2)}\n👤 **Student:** ${student.firstName} ${student.lastName} (${student.studentId})\n🏫 **Class:** ${student.classAssigned}\n📄 **Receipt:** ${receiptNumber}\n\n💳 **Remaining Balance:** GHS ${receiptData.remainingBalance.toFixed(2)}`,
      action: 'payment',
      data: receiptData
    };
  }

  private handleReceiptRequest(input: string): AIResponse | string {
    const studentQuery = input.replace(/show|receipt|print|for|the/gi, '').trim();
    const student = this.findStudent(studentQuery);
    
    if (!student) {
      return 'Please specify which student\'s receipt you want to see. Try "Show receipt for John Doe" or "Receipt for student ID 20240001"';
    }

    const lastPayment = this.data.payments
      .filter(p => p.studentId === student.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!lastPayment) {
      return `No payment records found for ${student.firstName} ${student.lastName}.`;
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
      content: `📄 **Latest receipt for ${student.firstName} ${student.lastName}** is ready to view.\n\n💰 **Amount:** GHS ${lastPayment.amount.toFixed(2)}\n📅 **Date:** ${new Date(lastPayment.date).toLocaleDateString()}\n💳 **Remaining Balance:** GHS ${receiptData.remainingBalance.toFixed(2)}`,
      action: 'receipt',
      data: receiptData
    };
  }

  private handleAllReceiptsRequest(input: string): AIResponse | string {
    const studentQuery = input.replace(/all|receipts|for|show|list/gi, '').trim();
    const student = this.findStudent(studentQuery);
    
    if (!student) {
      return 'Please specify which student\'s receipts you want to see. Try "All receipts for John Doe"';
    }

    const studentPayments = this.data.payments
      .filter(p => p.studentId === student.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (studentPayments.length === 0) {
      return `No payment records found for ${student.firstName} ${student.lastName}.`;
    }

    const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
    const receiptsText = studentPayments.map((payment, index) => 
      `${index + 1}. **GHS ${payment.amount.toFixed(2)}** - ${new Date(payment.date).toLocaleDateString()} (${payment.paymentMethod})`
    ).join('\n');

    return {
      content: `📄 **All receipts for ${student.firstName} ${student.lastName}:**\n\n${receiptsText}\n\n💰 **Total Paid:** GHS ${totalPaid.toFixed(2)}\n📊 **Number of Payments:** ${studentPayments.length}`,
      action: 'list',
      data: { student, payments: studentPayments }
    };
  }

  private handleBalanceRequest(input: string): AIResponse | string {
    // Check if asking for all students owing
    if (input.includes('all') || input.includes('students') || input.includes('who')) {
      return this.getStudentsOwing();
    }

    const studentQuery = input.replace(/balance|owes|owe|check|for|what|does|how|much|outstanding|debt/gi, '').trim();
    const student = this.findStudent(studentQuery);
    
    if (!student) {
      return 'Please specify which student\'s balance you want to check, or ask "Which students owe money?"';
    }

    const balanceInfo = this.calculateStudentBalance(student.id);
    if (!balanceInfo) {
      return 'Unable to calculate balance for this student.';
    }

    return {
      content: `💰 **Balance for ${student.firstName} ${student.lastName}:**\n\n🏫 **Class:** ${student.classAssigned}\n💵 **Current Term Fee:** GHS ${balanceInfo.currentTermFee.toFixed(2)}\n✅ **Total Paid:** GHS ${balanceInfo.totalPaid.toFixed(2)}\n⚠️ **Outstanding Balance:** GHS ${balanceInfo.balance.toFixed(2)}\n📊 **Payment History:** ${balanceInfo.payments.length} payments\n\n${balanceInfo.balance === 0 ? '✅ **Fully paid!**' : '❌ **Payment pending**'}`,
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
      content: `💸 **Students with outstanding balances:**\n\n${studentsText}${moreText}\n\n📊 **Total Students Owing:** ${studentsWithBalance.length}\n💰 **Total Amount Owing:** GHS ${totalOwing.toFixed(2)}`,
      action: 'list',
      data: studentsWithBalance
    };
  }

  private handleStudentListRequest(input: string): AIResponse | string {
    // Different list requests
    if (input.includes('class') || input.includes('grade')) {
      const classMatch = input.match(/class\s+([A-Za-z0-9\s\(\)]+)/i) || input.match(/grade\s+([A-Za-z0-9\s\(\)]+)/i);
      if (classMatch) {
        return this.getStudentsByClass(classMatch[1].trim());
      }
    }

    if (input.includes('new') || input.includes('recent')) {
      return this.getRecentStudents();
    }

    // Default: all students
    const studentsText = this.data.students
      .sort((a, b) => a.firstName.localeCompare(b.firstName))
      .map((student, index) => 
        `${index + 1}. **${student.firstName} ${student.lastName}** (${student.studentId}) - ${student.classAssigned}`
      ).join('\n');

    return {
      content: `👥 **All Students (${this.data.students.length}):**\n\n${studentsText}`,
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
        content: `No students found in class "${className}". Please check the class name.`,
        action: 'info'
      };
    }

    const studentsText = studentsInClass.map((student, index) => 
      `${index + 1}. **${student.firstName} ${student.lastName}** (${student.studentId})`
    ).join('\n');

    return {
      content: `👥 **Students in ${className} (${studentsInClass.length}):**\n\n${studentsText}`,
      action: 'list',
      data: studentsInClass
    };
  }

  private getRecentStudents(): AIResponse {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentStudents = this.data.students
      .filter(student => new Date(student.dateOfAdmission) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.dateOfAdmission).getTime() - new Date(a.dateOfAdmission).getTime());

    if (recentStudents.length === 0) {
      return {
        content: '📅 No new student admissions in the last 30 days.',
        action: 'info'
      };
    }

    const studentsText = recentStudents.map((student, index) => 
      `${index + 1}. **${student.firstName} ${student.lastName}** (${student.studentId}) - Admitted: ${new Date(student.dateOfAdmission).toLocaleDateString()}`
    ).join('\n');

    return {
      content: `🆕 **Recent Student Admissions (${recentStudents.length}):**\n\n${studentsText}`,
      action: 'list',
      data: recentStudents
    };
  }

  private handleStatisticsRequest(input: string): AIResponse {
    if (input.includes('student')) {
      const studentStats = this.getStudentStatistics();
      return {
        content: studentStats,
        action: 'stats'
      };
    }

    if (input.includes('teacher')) {
      return {
        content: `👨‍🏫 **Teacher Statistics:**\n\n• **Total Teachers:** ${this.data.teachers.length}\n• **Active:** ${this.data.teachers.filter(t => t.employmentStatus === 'Active').length}\n• **Classes with Teachers:** ${this.data.classes.filter(c => c.assignedTeacher).length}`,
        action: 'stats'
      };
    }

    if (input.includes('payment') || input.includes('money') || input.includes('fee')) {
      return this.getPaymentStatistics();
    }

    // General stats
    const totalPaid = this.data.payments.reduce((sum, p) => sum + p.amount, 0);
    const studentsOwing = this.data.students.filter(s => {
      const balance = this.calculateStudentBalance(s.id);
      return balance && balance.balance > 0;
    }).length;

    return {
      content: `📊 **Rosa Gardens School Statistics:**\n\n👥 **Students:** ${this.data.students.length}\n👨‍🏫 **Teachers:** ${this.data.teachers.length}\n🏫 **Classes:** ${this.data.classes.length}\n💰 **Total Payments:** GHS ${totalPaid.toFixed(2)}\n📊 **Students Owing:** ${studentsOwing}\n📅 **Current Term:** ${getActiveAcademicTerm()}`,
      action: 'stats'
    };
  }

  private getStudentStatistics(): string {
    const classCounts = this.data.classes.map(cls => {
      const count = this.data.students.filter(s => s.classAssigned === cls.className).length;
      return `• **${cls.className}:** ${count}/${cls.maxClassSize} students`;
    }).join('\n');

    return `👥 **Student Statistics:**\n\n📊 **Total Students:** ${this.data.students.length}\n\n🏫 **By Class:**\n${classCounts}`;
  }

  private getPaymentStatistics(): AIResponse {
    const currentTerm = getActiveAcademicTerm();
    const currentTermPayments = this.data.payments.filter(p => p.term === currentTerm);
    const totalCurrentTerm = currentTermPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalAllTime = this.data.payments.reduce((sum, p) => sum + p.amount, 0);

    const methodStats = this.data.payments.reduce((acc, payment) => {
      acc[payment.paymentMethod] = (acc[payment.paymentMethod] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const methodText = Object.entries(methodStats)
      .map(([method, count]) => `• **${method}:** ${count} payments`)
      .join('\n');

    return {
      content: `💰 **Payment Statistics:**\n\n📊 **Current Term (${currentTerm}):**\n• **Payments:** ${currentTermPayments.length}\n• **Amount:** GHS ${totalCurrentTerm.toFixed(2)}\n\n📈 **All Time:**\n• **Total Payments:** ${this.data.payments.length}\n• **Total Amount:** GHS ${totalAllTime.toFixed(2)}\n\n💳 **By Payment Method:**\n${methodText}`,
      action: 'stats'
    };
  }

  private handleStudentSearch(input: string): AIResponse | string {
    const query = input.replace(/find|search|student|info|for|show|me/gi, '').trim();
    const student = this.findStudent(query);
    
    if (!student) {
      return 'Student not found. Please check the student ID or name. Try "Find student John Doe" or "Search for 20240001"';
    }

    const balanceInfo = this.calculateStudentBalance(student.id);
    const paymentCount = this.data.payments.filter(p => p.studentId === student.id).length;

    return {
      content: `👤 **Student Information:**\n\n📝 **Name:** ${student.firstName} ${student.lastName}\n🆔 **Student ID:** ${student.studentId}\n🏫 **Class:** ${student.classAssigned}\n📞 **Guardian:** ${student.guardianName}\n☎️ **Contact:** ${student.guardianContact}\n📅 **Admission:** ${new Date(student.dateOfAdmission).toLocaleDateString()}\n💰 **Balance:** GHS ${balanceInfo?.balance.toFixed(2) || '0.00'}\n📊 **Payments Made:** ${paymentCount}`,
      action: 'search',
      data: { student, balanceInfo }
    };
  }

  private handleClassInfo(input: string): AIResponse | string {
    const classMatch = input.match(/class\s+([A-Za-z0-9\s\(\)]+)/i) || 
                       input.match(/students\s+in\s+([A-Za-z0-9\s\(\)]+)/i);
    
    if (!classMatch) {
      return 'Please specify which class you want information about. Try "Students in Class 4" or "Class info for KG1"';
    }

    const className = classMatch[1].trim();
    const classInfo = this.data.classes.find(c => 
      c.className.toLowerCase().includes(className.toLowerCase())
    );

    if (!classInfo) {
      return `Class "${className}" not found. Please check the class name.`;
    }

    const studentsInClass = this.data.students.filter(s => s.classAssigned === classInfo.className);
    const teacher = this.data.teachers.find(t => t.id === classInfo.assignedTeacher);
    
    return {
      content: `🏫 **Class Information: ${classInfo.className}**\n\n👥 **Students:** ${studentsInClass.length}/${classInfo.maxClassSize}\n👨‍🏫 **Teacher:** ${teacher ? teacher.fullName : 'Not assigned'}\n📚 **Level:** ${classInfo.level}\n🌟 **Stream:** ${classInfo.stream}`,
      action: 'info',
      data: { classInfo, students: studentsInClass, teacher }
    };
  }

  private getHelpResponse(): AIResponse {
    return {
      content: `🤖 **I can help you with many tasks! Here are some examples:**\n\n💰 **Payments:**\n• "Record payment of 500 for student 20240001"\n• "Payment of 300 for John Doe"\n\n📄 **Receipts:**\n• "Show receipt for Mary Smith"\n• "All receipts for student 20240002"\n\n💳 **Balances:**\n• "Check balance for John Doe"\n• "Which students owe money?"\n• "Students with outstanding balances"\n\n👥 **Student Information:**\n• "List all students"\n• "Students in Class 4"\n• "Find student John Doe"\n• "Recent student admissions"\n\n📊 **Statistics:**\n• "How many students?"\n• "Payment statistics"\n• "Class information for KG1"\n\nJust ask me naturally - I'll understand! 😊`,
      action: 'info'
    };
  }
}
