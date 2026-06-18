import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, detailDialogContentWideClass, detailDialogHeaderClass, detailDialogBodyClass, detailDialogFooterClass } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiService } from '../../services/api';
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
  Bus,
  Compass,
  Loader2,
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

  interface StudentTransportInfo {
    enrolled_at: string;
    status: string;
    route_name: string;
    route_id: string;
    time_of_day: string;
    route_color: string;
    stop_name: string;
    stop_id: string;
    latitude: string;
    longitude: string;
    plate_number: string | null;
    vehicle_name: string | null;
    driver_name: string | null;
    driver_phone: string | null;
  }

  const [transportInfo, setTransportInfo] = React.useState<StudentTransportInfo | null>(null);
  const [loadingTransport, setLoadingTransport] = React.useState(false);

  React.useEffect(() => {
    if (open && student?.id) {
      setLoadingTransport(true);
      apiService.get<StudentTransportInfo | null>(`/transport/student/${student.id}`)
        .then(data => {
          setTransportInfo(data);
        })
        .catch(err => {
          console.error('Failed to fetch student transport details:', err);
        })
        .finally(() => {
          setLoadingTransport(false);
        });
    } else {
      setTransportInfo(null);
    }
  }, [open, student?.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${detailDialogContentWideClass} sm:max-w-4xl`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2 pr-0">
            {alumni ? <GraduationCap className="w-5 h-5 shrink-0 text-indigo-600" /> : <User className="w-5 h-5 shrink-0" />}
            <span className="min-w-0 break-words">{alumni ? 'Alumni profile' : 'Student profile'}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {student.firstName} {student.lastName} · {student.studentId}
          </p>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-6`}>
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

          <Tabs defaultValue="general" className="w-full mt-4 flex flex-col">
            <TabsList className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-10 w-full max-w-md shrink-0">
              <TabsTrigger value="general" className="rounded-lg text-xs font-semibold">General Info</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-lg text-xs font-semibold">Billing & Payments</TabsTrigger>
              <TabsTrigger value="transport" className="rounded-lg text-xs font-semibold">Transport</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 pt-4 focus-visible:outline-none">
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
            </TabsContent>

            <TabsContent value="billing" className="space-y-6 pt-4 focus-visible:outline-none">
              {paymentsWithBalance.length > 0 ? (
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
              ) : (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-2xl bg-slate-50/50 text-slate-500">
                  <CreditCard className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600 text-sm">No Payment History</p>
                  <p className="text-xs text-slate-400 mt-1">There are no recorded fee payments for this student in this term.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transport" className="space-y-6 pt-4 focus-visible:outline-none">
              {loadingTransport ? (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-50/20 border border-dashed rounded-2xl">
                  <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-slate-400 mt-2">Loading transport details...</p>
                </div>
              ) : transportInfo ? (
                <div className="space-y-6">
                  {/* Active Route overview card */}
                  <Card className="overflow-hidden border-slate-200 shadow-sm" style={{ borderLeftWidth: '6px', borderLeftColor: transportInfo.route_color || '#3b82f6' }}>
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-indigo-600 text-white font-bold hover:bg-indigo-700 capitalize text-[10px] px-2 py-0.5 rounded-full">
                            Active Rider
                          </Badge>
                          {transportInfo.time_of_day && (
                            <Badge variant="outline" className="text-[10px] font-semibold border-slate-200 capitalize">
                              Shift: {transportInfo.time_of_day}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-1.5">{transportInfo.route_name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          Boarding / Drop-off Stop: <strong className="text-slate-700">{transportInfo.stop_name}</strong>
                        </p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">Enrolled On</span>
                        <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                          {formatDisplayDate(transportInfo.enrolled_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vehicle */}
                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <Bus className="w-4 h-4 text-indigo-600" />
                          <h3 className="font-semibold text-slate-800 text-sm">Assigned Vehicle</h3>
                        </div>
                        {transportInfo.vehicle_name ? (
                          <div className="space-y-3">
                            <div>
                              <span className="text-xs text-slate-400 block">Bus Name</span>
                              <p className="font-semibold text-slate-800">{transportInfo.vehicle_name}</p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-400 block">Plate Number</span>
                              <p className="font-mono font-semibold text-slate-700 bg-slate-50 border rounded px-2 py-0.5 w-fit">{transportInfo.plate_number}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No shuttle vehicle assigned to this route yet.</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Driver */}
                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <User className="w-4 h-4 text-violet-600" />
                          <h3 className="font-semibold text-slate-800 text-sm">Assigned Driver</h3>
                        </div>
                        {transportInfo.driver_name ? (
                          <div className="space-y-3">
                            <div>
                              <span className="text-xs text-slate-400 block">Driver Name</span>
                              <p className="font-semibold text-slate-800">{transportInfo.driver_name}</p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-400 block">Contact Phone</span>
                              {transportInfo.driver_phone ? (
                                <a href={`tel:${transportInfo.driver_phone}`} className="font-semibold text-indigo-600 hover:underline flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3.5 w-3.5 animate-pulse" />
                                  {transportInfo.driver_phone}
                                </a>
                              ) : (
                                <p className="text-slate-500">—</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No driver assigned to this route yet.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Stop Coordinates Details */}
                  {transportInfo.latitude && transportInfo.longitude && (
                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-2 text-slate-600 text-xs">
                          <Compass className="h-4 w-4 text-slate-400 shrink-0 animate-spin-slow" style={{ animationDuration: '8s' }} />
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Stop Location Coordinates</span>
                            <span className="font-mono text-slate-700 block mt-0.5">
                              Lat: {parseFloat(transportInfo.latitude).toFixed(5)}, Lng: {parseFloat(transportInfo.longitude).toFixed(5)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-2xl bg-slate-50/50 text-slate-500">
                  <Bus className="h-10 w-10 text-slate-300 mb-2 animate-bounce" />
                  <p className="font-semibold text-slate-600 text-sm">No Transport Enrollment</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                    This student is not currently enrolled in any transport service. Map them to a route stop in the Transport module.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter className={detailDialogFooterClass}>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentDetailsDialog;
