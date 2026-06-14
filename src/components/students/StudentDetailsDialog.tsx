import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  User,
  Calendar,
  Phone,
  MapPin,
  School,
  Users,
  FileText,
  CreditCard,
  GraduationCap,
} from 'lucide-react';
import { enrollmentStatusLabel, isAlumniStudent, statusBadgeClass, normalizeEnrollmentStatus, guardianContactLinks } from './studentRegistryUtils';
import { cn } from '@/lib/utils';
import { resolveLogoUrl } from '../../services/tenantService';
import { formatDisplayDate } from '../../utils/dateFormat';
import { isActivePayment, paymentAmountValue } from '../../utils/feeCalculations';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  studentId: string;
  admissionNumber: string;
  classAssigned: string;
  guardianName: string;
  guardianContact: string;
  guardian2Name?: string;
  guardian2Contact?: string;
  guardian2Relationship?: string;
  homeAddress: string;
  numberOfSiblings: number;
  namesOfSiblings: string;
  previousSchool: string;
  dateOfAdmission: string;
  notes: string;
  passportPhotoUrl?: string;
  isBeneficiary?: boolean;
  beneficiaryType?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  beneficiaryNotes?: string;
  enrollmentStatus?: string;
  graduatedAt?: string;
}

interface Payment {
  id: string;
  studentId?: string;
  amount: number;
  amount_paid?: number;
  date: string;
  paymentMethod: string;
  receiptNumber?: string;
  term?: string;
  isVoided?: boolean;
}

interface StudentDetailsDialogProps {
  student: Student | null;
  open: boolean;
  onClose: () => void;
  payments?: Payment[];
  totalFeesForStudent?: number;
}

const StudentDetailsDialog: React.FC<StudentDetailsDialogProps> = ({ student, open, onClose, payments = [], totalFeesForStudent = 0 }) => {
  if (!student) return null;

  const alumni = isAlumniStudent(student);
  const status = normalizeEnrollmentStatus(student.enrollmentStatus);

  const studentPayments = payments.filter((p: any) => String(p.studentId) === String(student.id));
  let runningPaid = 0;
  const paymentsWithBalance = [...studentPayments]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(p => {
      if (isActivePayment(p)) {
        runningPaid += paymentAmountValue(p);
      }
      return { ...p, remainingAfter: Math.max(0, totalFeesForStudent - runningPaid) };
    })
    .reverse();

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[min(90dvh,900px)] max-w-4xl flex-col gap-0 overflow-hidden p-0 [&>button.absolute]:hidden">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center space-x-2">
            {alumni ? <GraduationCap className="w-5 h-5 text-indigo-600" /> : <User className="w-5 h-5" />}
            <span>{alumni ? 'Alumni profile' : 'Student complete profile'}</span>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6 px-6 py-4">
          {/* Student Header Card with Passport Photo */}
          <Card className={cn('border-slate-200', alumni && 'border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-slate-50 dark:from-indigo-950/30 dark:to-slate-900/50')}>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Passport Photo - large and prominent */}
                <div className="shrink-0">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-inner">
                    {student.passportPhotoUrl ? (
                      <img
                        src={resolveLogoUrl(student.passportPhotoUrl)!}
                        alt={`${student.firstName} ${student.lastName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-16 h-16 md:w-20 md:h-20 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">Passport Photo</p>
                </div>
                <div className="flex-1 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {student.firstName} {student.lastName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant={student.gender === 'Male' ? 'default' : 'secondary'} className="text-sm">
                        {student.gender}
                      </Badge>
                      <span className="text-sm text-slate-600">
                        Age: {calculateAge(student.dateOfBirth)} years
                      </span>
                      <Badge
                        variant="outline"
                        className={cn('text-sm capitalize', statusBadgeClass(status))}
                      >
                        {enrollmentStatusLabel(student.enrollmentStatus)}
                      </Badge>
                      {student.classAssigned && (
                        <Badge variant="outline" className="bg-white">
                          {alumni ? `Graduated from ${student.classAssigned}` : student.classAssigned}
                        </Badge>
                      )}
                      {alumni && student.graduatedAt && (
                        <Badge variant="outline" className="border-indigo-300/50 text-indigo-700 dark:text-indigo-300">
                          Graduated {formatDisplayDate(student.graduatedAt)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-left md:text-right shrink-0">
                    <div className="text-sm text-slate-500">Student ID</div>
                    <div className="font-mono text-lg font-bold bg-white px-3 py-1 rounded border border-slate-200">
                      {student.studentId}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      Admission: {student.admissionNumber}
                    </div>
                  </div>
                </div>
              </div>
              {student.isBeneficiary && (
                <div className="mt-4 pt-4 border-t border-indigo-100 flex items-center gap-3">
                  <User className="w-5 h-5 text-indigo-600" />
                  <div>
                    <span className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Beneficiary:</span>
                    <span className="ml-2 text-sm font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      {student.beneficiaryType?.replace(/Scholarship/g, 'Discount').replace(/scholarship/g, 'discount').replace(/SCHOLARSHIP/g, 'DISCOUNT')}
                    </span>
                    <span className="ml-2 text-sm font-black text-indigo-600">
                      ({student.discountType === 'percentage' ? `${student.discountValue}% Off` : `GHS ${student.discountValue?.toLocaleString()} Discount`})
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold">Personal Information</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">First Name</label>
                      <p className="font-medium">{student.firstName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Name</label>
                      <p className="font-medium">{student.lastName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{formatDisplayDate(student.dateOfBirth)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nationality</label>
                      <p>{student.nationality}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Academic Information */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <School className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold">Academic Information</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">{alumni ? 'Last class' : 'Current class'}</label>
                    <Badge variant="outline" className="text-sm">{student.classAssigned}</Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date of Admission</label>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{formatDisplayDate(student.dateOfAdmission)}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Previous School</label>
                    <p className="text-sm">{student.previousSchool || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Guardian Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 mb-4">
                <Phone className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold">Guardian Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Guardian Name</label>
                  <p className="font-medium">{student.guardianName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Contact Number</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {(() => {
                      const links = guardianContactLinks(student.guardianContact);
                      return links.tel ? (
                        <>
                          <a href={links.tel} className="font-mono text-indigo-600 hover:underline">
                            {links.display}
                          </a>
                          {links.whatsapp && (
                            <a
                              href={links.whatsapp}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-emerald-600 hover:underline"
                            >
                              WhatsApp
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="font-mono">{links.display}</span>
                      );
                    })()}
                  </div>
                </div>
                {(student.guardian2Name || student.guardian2Contact) && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Second Guardian</label>
                      <p className="font-medium">
                        {student.guardian2Name || '—'}
                        {student.guardian2Relationship ? (
                          <span className="text-sm text-muted-foreground"> ({student.guardian2Relationship})</span>
                        ) : null}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Second Guardian Contact</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {(() => {
                          const links = guardianContactLinks(student.guardian2Contact);
                          return links.tel ? (
                            <>
                              <a href={links.tel} className="font-mono text-indigo-600 hover:underline">
                                {links.display}
                              </a>
                              {links.whatsapp && (
                                <a
                                  href={links.whatsapp}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-emerald-600 hover:underline"
                                >
                                  WhatsApp
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="font-mono">{links.display}</span>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Home Address</label>
                  <div className="flex items-start space-x-2 mt-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-sm">{student.homeAddress}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Family Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-4 h-4 text-orange-600" />
                <h3 className="font-semibold">Family Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Number of Siblings</label>
                  <p className="text-lg font-semibold">{student.numberOfSiblings}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Names of Siblings</label>
                  <p className="text-sm">{student.namesOfSiblings || 'None specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Beneficiary Details */}
          {student.isBeneficiary && (
            <Card className="border-indigo-200 bg-indigo-50/30">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-semibold text-indigo-900">Beneficiary & Discount Details</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Discount Type</label>
                      <p className="font-bold text-slate-800">{student.beneficiaryType?.replace(/Scholarship/g, 'Discount').replace(/scholarship/g, 'discount').replace(/SCHOLARSHIP/g, 'DISCOUNT')}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Discount applied</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          {student.discountType === 'percentage' ? `${student.discountValue}%` : `GHS ${student.discountValue?.toLocaleString()}`}
                        </Badge>
                        <span className="text-xs text-slate-500 font-medium">({student.discountType === 'percentage' ? 'Percentage based' : 'Fixed amount deduction'})</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Discount Notes</label>
                    <div className="mt-1 p-3 bg-white rounded-lg border border-indigo-100 text-sm text-slate-600 italic">
                      {student.beneficiaryNotes || 'No specific notes recorded for this beneficiary status.'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment History */}
          {paymentsWithBalance.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <CreditCard className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold">Payment History</h3>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Balance After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsWithBalance.map((p) => (
                        <TableRow key={p.id} className={p.isVoided ? 'opacity-70' : undefined}>
                          <TableCell>{formatDisplayDate(p.date)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${p.isVoided ? 'line-through text-muted-foreground' : 'text-green-600'}`}>
                                GHS {paymentAmountValue(p).toLocaleString()}
                              </span>
                              {p.isVoided && <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>{p.paymentMethod}</TableCell>
                          <TableCell className="font-mono text-sm">{p.receiptNumber || '-'}</TableCell>
                          <TableCell>GHS {p.remainingAfter.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Notes */}
          {student.notes && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <h3 className="font-semibold">Additional Notes</h3>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{student.notes}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default StudentDetailsDialog;
