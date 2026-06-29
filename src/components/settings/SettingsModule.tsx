
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import {
  Settings, Key, Building, Download, Receipt,
  GraduationCap, Copy, ExternalLink, ShieldAlert, RefreshCw, Pen, Stamp,
} from 'lucide-react';
import AcademicTermManager from './AcademicTermManager';
import ArrearsSyncModal from './ArrearsSyncModal';
import SchoolManager from './SchoolManager';
import SignatureStampManager from './SignatureStampManager';
import HeadmasterSignatureSettings from './HeadmasterSignatureSettings';
import PaymentDetailsSettings from './PaymentDetailsSettings';
import { getTenantParentPortalUrl } from '../../utils/tenantHost';

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
  const { user, hasAccess, changePassword, isPlatformSuperAdmin } = useAuth();
  const { school, reloadSchool } = useSchool();
  const { refresh: refreshData } = useData();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSyncingArrears, setIsSyncingArrears] = useState(false);
  const [arrearsSyncOpen, setArrearsSyncOpen] = useState(false);

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

  const isSuperAdmin = isPlatformSuperAdmin;
  const hasSettingsFull = hasAccess('settings-full');
  const canBackupSchool = hasSettingsFull || (user?.role === 'administrator' && !!school?.id);

  const getParentPortalUrl = () =>
    getTenantParentPortalUrl(school?.slug ?? null, school?.id);

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
      await reloadSchool();
      window.dispatchEvent(new CustomEvent('school-branding-changed'));
      loadSettings(); // Re-load settings after update
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update school information",
        variant: "destructive"
      });
    }
  };

  const handleExportJSON = async () => {
    try {
      if (!school?.id) {
        toast({ title: "Backup Failed", description: "School context is not ready.", variant: "destructive" });
        return;
      }

      const exportData = await apiService.get<any>(`/schools/${school.id}/backup`);

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (school.name || 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      link.download = `scholarnerve_backup_${safeName || 'school'}_${new Date().toISOString().split('T')[0]}.json`;
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

  const handleSyncArrears = () => {
    if (isSyncingArrears || arrearsSyncOpen) return;
    setArrearsSyncOpen(true);
  };

  const handleArrearsSyncComplete = async () => {
    setArrearsSyncOpen(false);
    setIsSyncingArrears(false);
    await refreshData();
    toast({
      title: 'Arrears Updated',
      description: 'Unpaid balances have been recalculated for the active term.',
    });
  };

  if (!hasSettingsFull && !hasAccess('settings-password-only')) {
    return null;
  }

  if (!hasSettingsFull) {
    const isSchoolAdmin = user?.role === 'administrator';
    const isHeadmaster = user?.role === 'headmaster';
    // Regular user settings view (password + optional backup for school admins)
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
              <Key className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
              <p className="text-muted-foreground">
                {isHeadmaster
                  ? 'Change your password and manage your report card signature'
                  : isSchoolAdmin
                    ? 'Change your password and manage school backup'
                    : 'Change your password'}
              </p>
            </div>
          </div>
        </div>

        {isHeadmaster && user?.teacherId && (
          <Card className="shadow-sm max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Pen className="w-5 h-5 text-purple-600" />
                <span>Report Card Signature</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Upload or draw your signature. It will auto-fill when you open report cards.
              </p>
            </CardHeader>
            <CardContent>
              <HeadmasterSignatureSettings teacherId={user.teacherId} />
            </CardContent>
          </Card>
        )}

        {isSchoolAdmin && canBackupSchool && (
          <Card className="shadow-sm max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="w-5 h-5" />
                <span>School Backup</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Download a complete backup of your school&apos;s data as a JSON file.
              </p>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full h-9" onClick={handleExportJSON}>
                <Download className="w-4 h-4 mr-2" />
                Create Backup
              </Button>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Restore and reset are managed by Super Admin only.
              </p>
            </CardContent>
          </Card>
        )}

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
              <Button type="submit" variant="primaryAction" className="w-full" disabled={!currentPassword || !newPassword || !confirmPassword}>
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
    <div className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
            <p className="text-sm text-muted-foreground">Configure system settings and preferences</p>
          </div>
        </div>
      </div>

      {/* School Management - Super-Admin only */}
      {isSuperAdmin && <SchoolManager />}

      {hasSettingsFull && <AcademicTermManager />}

      {hasSettingsFull && <PaymentDetailsSettings />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <Card className="shadow-sm">
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center space-x-2 text-base">
              <Key className="w-4 h-4" />
              <span>Change Password</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <form onSubmit={handlePasswordChange} className="space-y-3">
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
              <Button type="submit" variant="primaryAction" className="w-full" disabled={!currentPassword || !newPassword || !confirmPassword}>
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {hasSettingsFull && (
          <Card className="xl:col-span-2 shadow-sm">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center space-x-2 text-base">
                <Building className="w-4 h-4" />
                <span>School Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <form onSubmit={handleSchoolInfoUpdate} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="physicalAddress">Physical Address (Parent Desk)</Label>
                  <Input
                    id="physicalAddress"
                    value={schoolInfo.physicalAddress}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, physicalAddress: e.target.value })}
                    placeholder="School location for Parent Desk"
                  />
                </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <Button type="submit" variant="primaryAction" className="w-full h-9">
                  Update School Information
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {hasSettingsFull && (
          <Card className="shadow-sm">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center space-x-2 text-base">
                <Receipt className="w-4 h-4" />
                <span>Receipt Customization</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Customize printed receipts</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
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
              }} className="space-y-3">
                <div className="space-y-2">
                  <Label>Receipt Number Prefix</Label>
                  <Input
                    value={receiptSettings.receipt_prefix}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, receipt_prefix: e.target.value })}
                    placeholder="R (default)"
                    maxLength={5}
                  />
                  <p className="text-xs text-muted-foreground">e.g. R for R00012345</p>
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
                <Button type="submit" variant="primaryAction" className="w-full h-9">Save Receipt Settings</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {hasSettingsFull && (
          <Card className="shadow-sm border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center space-x-2 text-base">
                <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Arrears Sync</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Term changes now calculate previous-term arrears automatically. Use this button for manual refresh if needed.
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Button
                type="button"
                variant="primaryAction"
                className="w-full h-9"
                onClick={handleSyncArrears}
                disabled={isSyncingArrears || arrearsSyncOpen}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingArrears ? 'animate-spin' : ''}`} />
                {isSyncingArrears ? 'Syncing Arrears...' : 'Sync Arrears Now'}
              </Button>
              <p className="mt-3 text-[11px] text-muted-foreground">
                This recalculates old balances and adds them to the active term fee balance.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Parent Portal Link */}
        {hasSettingsFull && school?.id && (
          <Card className="border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/10 backdrop-blur-sm overflow-hidden shadow-sm">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 font-bold text-base">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span>Parent Portal Gateway</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Share this secure link with parents to provide real-time access to grades, attendance, and financial records. 
                Parents log in using the <span className="text-foreground font-bold">Student ID</span> as both username and initial password.
              </p>
              
              <div className="flex items-center gap-2 bg-background/50 border border-purple-500/20 rounded-xl p-2.5 shadow-inner group">
                <code className="text-xs text-purple-600 dark:text-purple-400 flex-1 truncate font-mono select-all">
                  {getParentPortalUrl()}
                </code>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const url = getParentPortalUrl();
                      navigator.clipboard.writeText(url);
                      toast({ title: 'Link Copied', description: 'The branded parent portal link is now in your clipboard.' });
                    }}
                    className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-500/10 rounded-lg transition-all"
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={getParentPortalUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-500/10 rounded-lg transition-all"
                    title="Open portal"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <strong>Security Note:</strong> Parents will be prompted to change their password immediately upon their first successful login to ensure data privacy.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signatures & Stamp Settings */}
        <Card className="shadow-sm border-purple-500/20">
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center space-x-2 text-base">
              <Pen className="w-4 h-4 text-purple-600" />
              <span>Signatures &amp; Stamp</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Manage the school stamp and headmaster/admin signature used on appointment letters and report cards. Teachers can set their own signature from their profile.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <SignatureStampManager />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center space-x-2 text-base">
              <Download className="w-4 h-4" />
              <span>School Backup</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Create a full backup of this school&apos;s data (all tables).</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Button variant="outline" className="w-full h-9" onClick={handleExportJSON}>
              <Download className="w-4 h-4 mr-2" />
              Create Backup
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Import, restore, and reset actions are managed by Super Admin only.
            </p>
          </CardContent>
        </Card>
      </div>

      <ArrearsSyncModal
        open={arrearsSyncOpen}
        onClose={() => {
          setArrearsSyncOpen(false);
          setIsSyncingArrears(false);
        }}
        onComplete={() => void handleArrearsSyncComplete()}
      />
    </div >
  );
};

export default SettingsModule;
