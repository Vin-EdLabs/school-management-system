
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, MapPin, Calendar, GraduationCap, Briefcase, DollarSign } from 'lucide-react';

interface Teacher {
  id: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  staffId: string;
  phoneNumber: string;
  email: string;
  address: string;
  subjectsTaught: string[];
  classAssigned: string;
  employmentDate: string;
  monthlySalary: number;
  employmentStatus: string;
  notes: string;
}

interface TeacherDetailsDialogProps {
  teacher: Teacher | null;
  open: boolean;
  onClose: () => void;
}

const TeacherDetailsDialog: React.FC<TeacherDetailsDialogProps> = ({
  teacher,
  open,
  onClose
}) => {
  if (!teacher) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="w-5 h-5" />
            <span>Teacher Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-base">{teacher.fullName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Staff ID</label>
                <p className="text-base font-mono">{teacher.staffId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Gender</label>
                <p className="text-base">{teacher.gender}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                <p className="text-base">
                  {teacher.dateOfBirth ? new Date(teacher.dateOfBirth).toLocaleDateString() : 'Not provided'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-500" />
                <span>{teacher.phoneNumber}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <span>{teacher.email}</span>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                <span>{teacher.address}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Academic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Academic Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Subjects Taught</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {teacher.subjectsTaught.map((subject, index) => (
                    <Badge key={index} variant="secondary">
                      {subject}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Class Assigned</label>
                <p className="text-base">
                  {teacher.classAssigned || 'No class assigned'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Employment Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Employment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div>
                  <label className="text-sm font-medium text-gray-500">Employment Date</label>
                  <p className="text-base">{new Date(teacher.employmentDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-gray-500" />
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <Badge 
                    className={
                      teacher.employmentStatus === 'Active' ? 'bg-green-100 text-green-800' :
                      teacher.employmentStatus === 'Left' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {teacher.employmentStatus}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <div>
                  <label className="text-sm font-medium text-gray-500">Monthly Salary</label>
                  <p className="text-base font-mono">
                    {teacher.monthlySalary > 0 ? `GHS ${teacher.monthlySalary.toLocaleString()}` : 'Not set'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {teacher.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Notes</h3>
                <p className="text-base text-gray-700">{teacher.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherDetailsDialog;
