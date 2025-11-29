
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useClasses from '@/hooks/useClasses';
import useFeeStructures from '@/hooks/useFeeStructures';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { FileText, GraduationCap, Printer, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { calculateStudentFeeStatus, getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';

const PrintFeeStatusModule = () => {
  const { students } = useStudents();
  const { classes } = useClasses();
  const { feeStructures } = useFeeStructures();
  const { payments } = usePayments();
  const [selectedClass, setSelectedClass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const activeAcademicTerm = getActiveAcademicTerm();
  const activeAcademicYear = getActiveAcademicYear();

  console.log('Active term:', activeAcademicTerm);
  console.log('Students:', students);
  console.log('Fee structures:', feeStructures);
  console.log('Payments:', payments);

  // Normalizers to tolerate camelCase / snake_case shapes
  const normalizeStudent = (s: any) => {
    const id = s?.id ?? s?.studentId ?? s?.student_id ?? s?._id ?? '';
    return {
      id,
      studentId: s?.studentId ?? s?.student_id ?? id,
      firstName: s?.firstName ?? s?.first_name ?? s?.fullName ?? s?.full_name ?? '',
      lastName: s?.lastName ?? s?.last_name ?? '',
      classAssigned: s?.classAssigned ?? s?.class_assigned ?? s?.className ?? s?.class_name ?? ''
    };
  };

  const normalizePayment = (p: any) => ({
    studentId: p?.studentId ?? p?.student_id ?? p?.student?.id ?? null,
    term: p?.term ?? p?.payment_term ?? p?.term_name ?? '',
    amount: Number(p?.amount ?? p?.value ?? 0) || 0,
    date: p?.date ?? p?.paymentDate ?? p?.payment_date ?? '',
    paymentMethod: p?.paymentMethod ?? p?.payment_method ?? p?.method ?? ''
  });

  const normalizeFee = (f: any) => ({
    className: f?.className ?? f?.class_name ?? '',
    term: f?.term ?? f?.term_name ?? '',
    amount: Number(f?.amount ?? f?.value ?? 0) || 0
  });

  const normalizedStudents = (students || []).map(normalizeStudent);
  const normalizedPayments = (payments || []).map(normalizePayment);
  const normalizedFees = (feeStructures || []).map(normalizeFee);

  // Normalize classes to a safe shape so we can access `className` without TS errors
  const normalizedClasses = (classes || []).map((c: any) => {
    const id = c?.id ?? c?._id ?? c?.classId ?? c?.class_id ?? '';
    const className = c?.className ?? c?.class_name ?? c?.name ?? c?.class ?? '';
    return { id, className };
  });

  // Filter classes based on search term
  const filteredClasses = useMemo(() => {
    const all = normalizedClasses;
    return all.filter((cls: any) => {
      const name = cls.className ?? '';
      return name && name.trim() !== '' && name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [classes, searchTerm]);

  // Get students for selected class with fee status
  const getStudentsWithFeeStatus = () => {
    if (!selectedClass) return [];

    const classStudents = normalizedStudents.filter(s => s.classAssigned === selectedClass);

    return classStudents.map(student => {
      const feeStatus = calculateStudentFeeStatus(student.id, activeAcademicTerm, normalizedStudents, normalizedFees, normalizedPayments);
      return {
        ...student,
        feeStatus
      };
    }).filter(student => student.feeStatus.status === 'Amount Owing' && student.feeStatus.balance > 0);
  };

  const studentsOwingFees = getStudentsWithFeeStatus();
  const totalOwing = studentsOwingFees.reduce((sum, student) => sum + (student.feeStatus?.balance || 0), 0);

  console.log('Students owing fees:', studentsOwingFees);
  console.log('Total owing:', totalOwing);

  const handlePrint = () => {
    if (!selectedClass || studentsOwingFees.length === 0) return;

    setIsGenerating(true);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student Fee Status Report - ${selectedClass}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3B82F6;
            padding-bottom: 20px;
          }
          .school-name {
            font-size: 24px;
            font-weight: bold;
            color: #1F2937;
            margin-bottom: 5px;
          }
          .school-subtitle {
            font-size: 14px;
            color: #6B7280;
            margin-bottom: 10px;
          }
          .report-title {
            font-size: 18px;
            font-weight: bold;
            color: #3B82F6;
            margin-top: 15px;
          }
          .report-info {
            background-color: #F3F4F6;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            color: #374151;
          }
          .info-value {
            color: #6B7280;
          }
          .students-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .students-table th,
          .students-table td {
            border: 1px solid #D1D5DB;
            padding: 12px;
            text-align: left;
          }
          .students-table th {
            background-color: #3B82F6;
            color: white;
            font-weight: bold;
          }
          .students-table tr:nth-child(even) {
            background-color: #F9FAFB;
          }
          .amount-owing {
            color: #DC2626;
            font-weight: bold;
          }
          .summary {
            margin-top: 25px;
            padding: 15px;
            background-color: #FEF3C7;
            border-radius: 8px;
            border-left: 4px solid #F59E0B;
          }
          .summary-text {
            font-size: 16px;
            font-weight: bold;
            color: #92400E;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #D1D5DB;
            font-size: 12px;
            color: #6B7280;
            text-align: center;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school-name">Rosa Gardens School</div>
          <div class="school-subtitle">School Management System</div>
          <div class="report-title">Student Fee Status Report</div>
        </div>
        
        <div class="report-info">
          <div class="info-row">
            <span class="info-label">Class:</span>
            <span class="info-value">${selectedClass}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Academic Year:</span>
            <span class="info-value">${activeAcademicYear}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Term:</span>
            <span class="info-value">${activeAcademicTerm}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Report Date:</span>
            <span class="info-value">${new Date().toLocaleDateString()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Students Owing Fees:</span>
            <span class="info-value">${studentsOwingFees.length}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Amount Owed:</span>
            <span class="info-value amount-owing">GHS ${totalOwing.toLocaleString()}</span>
          </div>
        </div>
        
        <table class="students-table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Amount Owed (GHS)</th>
              <th>Term/Year</th>
            </tr>
          </thead>
          <tbody>
            ${studentsOwingFees.map(student => `
              <tr>
                <td>${student.studentId}</td>
                <td>${student.firstName} ${student.lastName}</td>
                <td>${student.classAssigned}</td>
                <td class="amount-owing">${student.feeStatus.balance.toLocaleString()}</td>
                <td>${activeAcademicTerm} ${activeAcademicYear}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <div class="summary-text">
            Total Amount Owed: GHS ${totalOwing.toLocaleString()}
          </div>
        </div>
        
        <div class="footer">
          <p>Generated by Rosa Gardens School Management System</p>
          <p>Powered by TechNerve</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }

    setIsGenerating(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <Printer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Print Fee Status Report</h1>
            <p className="text-gray-600">Generate printable reports for students with outstanding fees</p>
          </div>
        </div>
      </div>

      {/* Academic Period Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Current Academic Period</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Academic Year</p>
              <p className="font-semibold">{activeAcademicYear}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Term</p>
              <p className="font-semibold">{activeAcademicTerm}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GraduationCap className="w-5 h-5" />
            <span>Select Class for Report</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Classes
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Type to search classes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Class Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Class
              </label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select a class to generate report" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-50">
                  {filteredClasses.length > 0 ? (
                    filteredClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.className} className="hover:bg-gray-50">
                        {cls.className}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-results" disabled>
                      No classes found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedClass && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Report Preview</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-blue-600">Selected Class</p>
                    <p className="font-medium">{selectedClass}</p>
                  </div>
                  <div>
                    <p className="text-blue-600">Students Owing Fees</p>
                    <p className="font-medium">{studentsOwingFees.length}</p>
                  </div>
                  <div>
                    <p className="text-blue-600">Total Amount Owed</p>
                    <p className="font-medium text-red-600">GHS {totalOwing.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Students Preview */}
      {selectedClass && studentsOwingFees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Students with Outstanding Fees</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {studentsOwingFees.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{student.firstName} {student.lastName}</p>
                    <p className="text-sm text-gray-500">ID: {student.studentId} • {student.classAssigned}</p>
                  </div>
                  <Badge variant="destructive">
                    GHS {(student.feeStatus?.balance || 0).toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Button
              onClick={handlePrint}
              disabled={!selectedClass || studentsOwingFees.length === 0 || isGenerating}
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
            >
              <Printer className="w-5 h-5 mr-2" />
              {isGenerating ? 'Generating Report...' : 'Generate & Print Report'}
            </Button>
          </div>

          {selectedClass && studentsOwingFees.length === 0 && (
            <div className="mt-4 text-center text-gray-500">
              <p>No students with outstanding fees found in {selectedClass}</p>
            </div>
          )}

          {!selectedClass && (
            <div className="mt-4 text-center text-gray-500">
              <p>Please select a class to generate the fee status report</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PrintFeeStatusModule;
