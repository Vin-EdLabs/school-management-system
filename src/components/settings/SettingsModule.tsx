
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useSchool } from '../../contexts/SchoolContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { reportService } from '../../services/reportService';
import {
  Settings, Key, Building, Download, Upload, RefreshCw, Receipt,
  GraduationCap, Copy, ExternalLink, AlertTriangle, ShieldAlert,
  FileJson, FileSpreadsheet, Lock, UserPlus
} from 'lucide-react';
import AcademicTermManager from './AcademicTermManager';
import SchoolManager from './SchoolManager';

interface SchoolSettings {
  name: string;
  address: string;
  contact: string;
  whatsappNumber: string;
  email: string;
  officeHours: string;
  physicalAddress: string;
  primaryColor: string;
  secondaryColor: string;
}

interface AcademicSettings {
  currentYear: string;
  currentTerm: string;
}

const SettingsModule = () => {
  const { user, hasAccess, changePassword } = useAuth();
  const { school } = useSchool();
  const { students, teachers, classes, payments, income, expenses } = useData();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings>({
    name: 'School',
    address: 'Accra, Ghana',
    contact: '+233 XX XXX XXXX',
    whatsappNumber: '',
    email: 'info@rosagardens.edu.gh',
    officeHours: 'Mon-Fri • 7:00am - 4:00pm',
    physicalAddress: '',
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
  });
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings>({
    currentYear: '2024',
    currentTerm: 'Term 1 2024'
  });
  const [receiptSettings, setReceiptSettings] = useState({
    receipt_prefix: 'R',
    postal_address: '',
    contact_phone: '',
    receipt_footer: '',
    bank_details: '',
  });

  const isSuperAdmin = hasAccess('schools');
  const hasSettingsFull = hasAccess('settings-full');

  const loadSettings = useCallback(async () => {
    if (!hasSettingsFull) return;
    try {
      const settings = await apiService.get<any>('/settings');
      if (settings) {
        setSchoolInfo({
          name: settings.school_name || 'School',
          address: settings.address || '',
          contact: settings.contact || '',
          whatsappNumber: settings.whatsapp_number || '',
          email: settings.email || '',
          officeHours: settings.office_hours || 'Mon-Fri • 7:00am - 4:00pm',
          physicalAddress: settings.physical_address || settings.address || '',
          primaryColor: school?.primary_color || '#2563eb',
          secondaryColor: school?.secondary_color || '#7c3aed',
        });
        setAcademicSettings({
          currentYear: settings.current_year || new Date().getFullYear().toString(),
          currentTerm: settings.current_term || '',
        });
        setReceiptSettings({
          receipt_prefix: settings.receipt_prefix || 'R',
          postal_address: settings.postal_address || '',
          contact_phone: settings.contact_phone || '',
          receipt_footer: settings.receipt_footer || '',
          bank_details: settings.bank_details || '',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Could not load system settings.',
        variant: 'destructive',
      });
    }
  }, [hasSettingsFull, school?.primary_color, school?.secondary_color]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (school && hasSettingsFull) {
      setSchoolInfo(prev => ({
        ...prev,
        primaryColor: school.primary_color || prev.primaryColor,
        secondaryColor: school.secondary_color || prev.secondaryColor,
      }));
    }
  }, [school?.primary_color, school?.secondary_color, hasSettingsFull]);

  const dispatchSettingsChange = () => {
    window.dispatchEvent(new CustomEvent('academicSettingsChanged'));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Password Mismatch", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    const minLength = user?.role === 'teacher' || user?.role === 'staff' ? 5 : 6;
    if (newPassword.length < minLength) {
      toast({ title: "Password Too Short", description: `Password must be at least ${minLength} characters long`, variant: "destructive" });
      return;
    }
    if (!currentPassword) {
      toast({ title: "Current Password Required", description: "Enter your current password to change it", variant: "destructive" });
      return;
    }
    try {
      const ok = await changePassword(currentPassword, newPassword);
      if (ok) {
        toast({ title: "Password Updated", description: "Your password has been changed successfully" });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast({ title: "Update Failed", description: "Current password may be incorrect", variant: "destructive" });
      }
    } catch {
      toast({ title: "Update Failed", description: "Current password may be incorrect", variant: "destructive" });
    }
  };

  const handleSchoolInfoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSettingsFull) return;

    try {
      await apiService.put('/settings', {
        school_name: schoolInfo.name,
        address: schoolInfo.address,
        contact: schoolInfo.contact,
        email: schoolInfo.email,
        phone_number: schoolInfo.contact,
        whatsapp_number: schoolInfo.whatsappNumber,
        office_hours: schoolInfo.officeHours,
        physical_address: schoolInfo.physicalAddress,
        primary_color: schoolInfo.primaryColor,
        secondary_color: schoolInfo.secondaryColor,
      });

      toast({
        title: "School Information Updated",
        description: "School details have been saved successfully",
      });
      loadSettings(); // Re-load settings after update
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update school information",
        variant: "destructive"
      });
    }
  };

  const handleExportJSON = () => {
    try {
      const exportData = {
        version: '1.2',
        timestamp: new Date().toISOString(),
        students, teachers, classes, payments, income, expenses,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `school_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Your school data has been exported as a JSON archive.",
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "Could not generate JSON backup.",
        variant: "destructive"
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      toast({ title: "Preparing Export", description: "Consolidating all school data for Excel..." });

      const flatData = [
        ...students.map((s: any) => ({ Type: 'Student', ID: s.studentId, Name: `${s.firstName} ${s.lastName}`, Class: s.classAssigned })),
        ...teachers.map((t: any) => ({ Type: 'Teacher', ID: t.staffId, Name: t.fullName, Role: 'Teacher' })),
        ...payments.map((p: any) => ({ Type: 'Payment', Date: p.paymentDate, Amount: p.amount, Method: p.paymentMethod })),
        ...income.map((i: any) => ({ Type: 'Income', Date: i.incomeDate, Source: i.source, Amount: i.amount })),
        ...expenses.map((e: any) => ({ Type: 'Expense', Date: e.paymentDate, Title: e.title, Amount: e.amount }))
      ];

      await reportService.exportToExcel(flatData, `school_summary_${new Date().toISOString().split('T')[0]}`, 'All Data');

      toast({
        title: "Excel Export Ready",
        description: "Summary data exported successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err?.message || "Could not generate Excel file.",
        variant: "destructive"
      });
    }
  };

  const handleResetData = async () => {
    if (!resetPassword) {
      toast({ title: "Verification Required", description: "Please enter your password to confirm.", variant: "destructive" });
      return;
    }

    setIsResetting(true);
    try {
      await apiService.post('/settings/reset-data', { password: resetPassword });
      toast({
        title: "System Reset Complete",
        description: "All records have been permanently cleared.",
      });
      setIsResetDialogOpen(false);
      setResetPassword('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast({
        title: "Reset Failed",
        description: err?.message || "Invalid password or server error.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };


  if (!hasSettingsFull && !hasAccess('settings-password-only')) {
    return null;
  }

  if (!hasSettingsFull) {
    // Regular user settings view
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
              <Key className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Account Settings</h1>
              <p className="text-gray-600">Change your password</p>
            </div>
          </div>
        </div>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Change Password</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`Enter new password (min ${user?.role === 'teacher' || user?.role === 'staff' ? 5 : 6} characters)`}
                  required
                  minLength={user?.role === 'teacher' || user?.role === 'staff' ? 5 : 6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={user?.role === 'teacher' || user?.role === 'staff' ? 5 : 6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!currentPassword || !newPassword || !confirmPassword}>
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Super-admin / Primary admin settings view
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>
            <p className="text-gray-600">Configure system settings and preferences</p>
          </div>
        </div>
      </div>

      {/* School Management - Super-Admin only */}
      {isSuperAdmin && <SchoolManager />}

      {hasSettingsFull && <AcademicTermManager />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Change Password</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPasswordFull">Current Password</Label>
                <Input
                  id="currentPasswordFull"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`Enter new password (min ${user?.role === 'teacher' || user?.role === 'staff' ? 5 : 6} characters)`}
                  required
                  minLength={user?.role === 'teacher' || user?.role === 'staff' ? 5 : 6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={user?.role === 'teacher' || user?.role === 'staff' ? 5 : 6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!currentPassword || !newPassword || !confirmPassword}>
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {hasSettingsFull && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="w-5 h-5" />
                <span>School Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSchoolInfoUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schoolName">School Name</Label>
                  <Input
                    id="schoolName"
                    value={schoolInfo.name}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, name: e.target.value })}
                    placeholder="Enter school name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolAddress">Address</Label>
                  <Input
                    id="schoolAddress"
                    value={schoolInfo.address}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, address: e.target.value })}
                    placeholder="Enter school address"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolContact">Contact Number</Label>
                  <Input
                    id="schoolContact"
                    value={schoolInfo.contact}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, contact: e.target.value })}
                    placeholder="Enter contact number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolWhatsapp">WhatsApp Number</Label>
                  <Input
                    id="schoolWhatsapp"
                    value={schoolInfo.whatsappNumber}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, whatsappNumber: e.target.value })}
                    placeholder="Enter WhatsApp number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolEmail">Email Address</Label>
                  <Input
                    id="schoolEmail"
                    type="email"
                    value={schoolInfo.email}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, email: e.target.value })}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="officeHours">Office Hours</Label>
                  <Input
                    id="officeHours"
                    value={schoolInfo.officeHours}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, officeHours: e.target.value })}
                    placeholder="Mon-Fri • 7:00am - 4:00pm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="physicalAddress">Physical Address (Parent Desk)</Label>
                  <Input
                    id="physicalAddress"
                    value={schoolInfo.physicalAddress}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, physicalAddress: e.target.value })}
                    placeholder="School location for Parent Desk"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color (Login & Branding)</Label>
                    <div className="flex gap-2">
                      <Input type="color" value={schoolInfo.primaryColor} onChange={(e) => setSchoolInfo({ ...schoolInfo, primaryColor: e.target.value })} className="w-14 h-10 p-1 cursor-pointer" />
                      <Input value={schoolInfo.primaryColor} onChange={(e) => setSchoolInfo({ ...schoolInfo, primaryColor: e.target.value })} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input type="color" value={schoolInfo.secondaryColor} onChange={(e) => setSchoolInfo({ ...schoolInfo, secondaryColor: e.target.value })} className="w-14 h-10 p-1 cursor-pointer" />
                      <Input value={schoolInfo.secondaryColor} onChange={(e) => setSchoolInfo({ ...schoolInfo, secondaryColor: e.target.value })} className="flex-1" />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Update School Information
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {hasSettingsFull && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Receipt className="w-5 h-5" />
                <span>Receipt Customization</span>
              </CardTitle>
              <p className="text-sm text-gray-500">Customize how receipts appear when printing</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await apiService.put('/settings', {
                    receipt_prefix: receiptSettings.receipt_prefix,
                    postal_address: receiptSettings.postal_address,
                    contact_phone: receiptSettings.contact_phone,
                    receipt_footer: receiptSettings.receipt_footer,
                    bank_details: receiptSettings.bank_details,
                  });
                  toast({ title: 'Receipt settings saved' });
                } catch (err: any) {
                  toast({ title: 'Error', description: err?.message, variant: 'destructive' });
                }
              }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Receipt Number Prefix</Label>
                  <Input
                    value={receiptSettings.receipt_prefix}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, receipt_prefix: e.target.value })}
                    placeholder="R (default)"
                    maxLength={5}
                  />
                  <p className="text-xs text-gray-500">e.g. R for R00012345</p>
                </div>
                <div className="space-y-2">
                  <Label>Postal Address (for receipt header)</Label>
                  <Input
                    value={receiptSettings.postal_address}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, postal_address: e.target.value })}
                    placeholder="P.O. Box 123, Accra"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input
                    value={receiptSettings.contact_phone}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, contact_phone: e.target.value })}
                    placeholder="+233 XX XXX XXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Footer Message</Label>
                  <Input
                    value={receiptSettings.receipt_footer}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, receipt_footer: e.target.value })}
                    placeholder="Thank you for your payment!"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank Details (optional)</Label>
                  <Input
                    value={receiptSettings.bank_details}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, bank_details: e.target.value })}
                    placeholder="Bank: XYZ, Account: 1234567890"
                  />
                </div>
                <Button type="submit" className="w-full">Save Receipt Settings</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Parent Portal Link */}
        {hasSettingsFull && school?.id && (
          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-purple-700">
                <GraduationCap className="w-5 h-5" />
                <span>Parent Portal</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Share this link with parents so they can view their child's grades, attendance and fee balance.
                Parents log in using their child's <strong>Student ID</strong> as both username and initial password.
              </p>
              <div className="flex items-center gap-2 bg-white border border-purple-200 rounded-lg p-2.5">
                <code className="text-xs text-purple-700 flex-1 truncate select-all">
                  {window.location.origin}/portal/{school.id}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/portal/${school.id}`);
                    toast({ title: 'Link copied!', description: 'Parent portal link copied to clipboard.' });
                  }}
                  className="text-purple-500 hover:text-purple-700 transition-colors shrink-0"
                  title="Copy link"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a
                  href={`/portal/${school.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-500 hover:text-purple-700 transition-colors shrink-0"
                  title="Open portal"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs text-gray-400">
                First-time login: Student ID is both the username and default password. Parents are prompted to change it on first login.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-red-100 shadow-xl overflow-hidden mt-6">
          <div className="h-1 bg-red-500" />
          <CardHeader>
            <CardTitle className="flex items-center space-x-3 text-red-700">
              <Download className="w-5 h-5" />
              <span>Data Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Export Section */}
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Export System Data</h4>
                <p className="text-sm text-slate-500 mb-4">
                  Archive all academic, financial, and personnel records for backup or migration.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border-2 border-slate-50 bg-slate-50/50 hover:border-blue-100 hover:bg-white transition-all cursor-pointer group" onClick={handleExportJSON}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-blue-600">
                        <FileJson className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">JSON Archive</p>
                        <p className="text-xs text-slate-500">Full system backup</p>
                      </div>
                      <Download className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border-2 border-slate-50 bg-slate-50/50 hover:border-emerald-100 hover:bg-white transition-all cursor-pointer group" onClick={handleExportExcel}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-emerald-600">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">Excel Spreadsheets</p>
                        <p className="text-xs text-slate-500">Summarized records</p>
                      </div>
                      <Download className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Import Section */}
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Import System Data</h4>
                <p className="text-sm text-slate-500 mb-4">
                  Quickly upload large volumes of student and teacher data using Excel or CSV templates.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border-2 border-slate-50 bg-slate-50/50 hover:border-blue-100 hover:bg-white transition-all cursor-pointer group relative overflow-hidden">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-blue-600">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">Import Students</p>
                        <p className="text-xs text-slate-500">Excel / CSV Support</p>
                      </div>
                    </div>
                    <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".csv,.xlsx,.xls" onChange={() => toast({ title: "Importing...", description: "Processing student data file..." })} />
                  </div>

                  <div className="p-4 rounded-xl border-2 border-slate-50 bg-slate-50/50 hover:border-emerald-100 hover:bg-white transition-all cursor-pointer group relative overflow-hidden">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-emerald-600">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">Import Teachers</p>
                        <p className="text-xs text-slate-500">Bulk staff onboarding</p>
                      </div>
                    </div>
                    <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".csv,.xlsx,.xls" onChange={() => toast({ title: "Importing...", description: "Processing staff data file..." })} />
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Reset Section */}
              <div className="p-6 rounded-2xl border-2 border-red-50 bg-red-50/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1 space-y-2">
                    <h4 className="text-lg font-bold text-red-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Reset Everything
                    </h4>
                    <p className="text-sm text-red-700 max-w-xl">
                      Permanently wipe all records and start from scratch.
                      <strong className="block mt-1 font-bold">This action is irreversible.</strong>
                    </p>
                  </div>

                  <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="h-12 px-8 rounded-xl font-bold shadow-lg shadow-red-100">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reset All Data
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md border-0 shadow-2xl">
                      <DialogHeader>
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-center text-2xl font-bold text-red-900">Are you absolutely sure?</DialogTitle>
                        <DialogDescription className="text-center space-y-4 pt-2">
                          <Alert variant="destructive" className="bg-red-50 border-red-200">
                            <AlertTitle className="flex items-center gap-2 text-red-800 font-bold">
                              <AlertTriangle className="h-4 w-4" />
                              Security Authentication Required
                            </AlertTitle>
                            <AlertDescription className="text-red-700">
                              All student files, financial records, and settings will be permanently erased.
                            </AlertDescription>
                          </Alert>
                          <p className="text-slate-600 font-medium">To authorize this reset, enter your administrator password.</p>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-auth">Admin Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                              id="reset-auth"
                              type="password"
                              placeholder="••••••••"
                              className="pl-10 h-11 border-2 border-slate-100 bg-slate-50 focus:border-red-500 rounded-xl"
                              value={resetPassword}
                              onChange={(e) => setResetPassword(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter className="flex flex-col sm:flex-row gap-3">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsResetDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1 h-12 rounded-xl font-bold"
                          onClick={handleResetData}
                          disabled={isResetting || !resetPassword}
                        >
                          {isResetting ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Yes, Authenticate & Reset'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsModule;
