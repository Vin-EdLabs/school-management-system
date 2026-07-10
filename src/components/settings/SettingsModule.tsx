
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
  Key, Building, Download, Receipt,
  GraduationCap, Copy, ExternalLink, ShieldAlert, RefreshCw, Pen,
  Wallet, Database,
} from 'lucide-react';
import AcademicTermManager from './AcademicTermManager';
import ArrearsSyncModal from './ArrearsSyncModal';
import SchoolManager from './SchoolManager';
import SignatureStampManager from './SignatureStampManager';
import HeadmasterSignatureSettings from './HeadmasterSignatureSettings';
import PaymentDetailsSettings from './PaymentDetailsSettings';
import { SettingsPageHeader, SettingsSection, SETTINGS_CARD_CLASS } from './SettingsSection';
import { getTenantParentPortalUrl } from '../../utils/tenantHost';
import { cn } from '@/lib/utils';

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

const SettingsModule: React.FC<{ onNavigateModule?: (module: string) => void }> = ({
  onNavigateModule,
}) => {
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
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-10 pb-10">
      <SettingsPageHeader
        title="System Settings"
        description="Manage your school profile, payments, parent portal, and account preferences."
      />

      {isSuperAdmin && (
        <SettingsSection
          icon={Database}
          title="Platform Administration"
          description="Super-admin tools for managing schools on the platform."
          accent="slate"
        >
          <SchoolManager />
        </SettingsSection>
      )}

      {hasSettingsFull && <AcademicTermManager onNavigateModule={onNavigateModule} />}

      {hasSettingsFull && (
        <SettingsSection
          icon={Building}
          title="School Identity"
          description="Name, contact details, branding colours, and public-facing information."
          accent="blue"
        >
          <Card className={SETTINGS_CARD_CLASS}>
            <CardHeader className="px-5 py-4 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-base font-semibold">School Information</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-5">
              <form onSubmit={handleSchoolInfoUpdate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="physicalAddress">Physical Address (Parent Desk)</Label>
                    <Input
                      id="physicalAddress"
                      value={schoolInfo.physicalAddress}
                      onChange={(e) => setSchoolInfo({ ...schoolInfo, physicalAddress: e.target.value })}
                      placeholder="School location for Parent Desk"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Brand Colours</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Primary (Login & Branding)</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={schoolInfo.primaryColor} onChange={(e) => setSchoolInfo({ ...schoolInfo, primaryColor: e.target.value })} className="w-14 h-10 p-1 cursor-pointer rounded-lg" />
                        <Input value={schoolInfo.primaryColor} onChange={(e) => setSchoolInfo({ ...schoolInfo, primaryColor: e.target.value })} className="flex-1 font-mono text-sm" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Secondary</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={schoolInfo.secondaryColor} onChange={(e) => setSchoolInfo({ ...schoolInfo, secondaryColor: e.target.value })} className="w-14 h-10 p-1 cursor-pointer rounded-lg" />
                        <Input value={schoolInfo.secondaryColor} onChange={(e) => setSchoolInfo({ ...schoolInfo, secondaryColor: e.target.value })} className="flex-1 font-mono text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
                <Button type="submit" variant="primaryAction" className="w-full sm:w-auto min-w-[200px] h-10">
                  Save School Information
                </Button>
              </form>
            </CardContent>
          </Card>
        </SettingsSection>
      )}

      {hasSettingsFull && (
        <SettingsSection
          icon={Wallet}
          title="Finance & Payments"
          description="Parent payment receiving details and printed receipt layout."
          accent="emerald"
        >
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <PaymentDetailsSettings />
            <Card className={SETTINGS_CARD_CLASS}>
              <CardHeader className="px-5 py-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Receipt className="h-4 w-4 text-emerald-600" />
                  Receipt Customization
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Header, footer, and numbering on fee receipts</p>
              </CardHeader>
              <CardContent className="px-5 py-5">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Receipt Prefix</Label>
                      <Input
                        value={receiptSettings.receipt_prefix}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, receipt_prefix: e.target.value })}
                        placeholder="R"
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact on Receipt</Label>
                      <Input
                        value={receiptSettings.contact_phone}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, contact_phone: e.target.value })}
                        placeholder="+233 XX XXX XXXX"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Postal Address</Label>
                    <Input
                      value={receiptSettings.postal_address}
                      onChange={(e) => setReceiptSettings({ ...receiptSettings, postal_address: e.target.value })}
                      placeholder="P.O. Box 123, Accra"
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
                  <Button type="submit" variant="primaryAction" className="w-full h-10">Save Receipt Settings</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </SettingsSection>
      )}

      {hasSettingsFull && school?.id && (
        <SettingsSection
          icon={GraduationCap}
          title="Parent Portal"
          description="Share the branded link so parents can view grades, fees, and attendance."
          accent="purple"
        >
          <Card className={cn(SETTINGS_CARD_CLASS, 'border-purple-500/20 bg-gradient-to-br from-purple-500/[0.03] to-transparent max-w-3xl')}>
            <CardContent className="px-5 py-5 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Parents sign in with their child&apos;s <strong className="text-foreground">Student ID</strong> as username and initial password.
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-purple-500/20 bg-background/80 p-3 shadow-inner">
                <code className="text-xs text-purple-700 dark:text-purple-300 flex-1 truncate font-mono select-all">
                  {getParentPortalUrl()}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(getParentPortalUrl());
                    toast({ title: 'Link Copied', description: 'Parent portal link copied to clipboard.' });
                  }}
                  className="p-2 text-purple-600 hover:bg-purple-500/10 rounded-lg transition-colors"
                  title="Copy link"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a
                  href={getParentPortalUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-purple-600 hover:bg-purple-500/10 rounded-lg transition-colors"
                  title="Open portal"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Parents must change their password on first login.
                </p>
              </div>
            </CardContent>
          </Card>
        </SettingsSection>
      )}

      {hasSettingsFull && (
        <SettingsSection
          icon={Pen}
          title="Documents & Signatures"
          description="School stamp and headmaster signature for letters and report cards."
          accent="purple"
        >
          <Card className={cn(SETTINGS_CARD_CLASS, 'border-purple-500/15')}>
            <CardContent className="px-5 py-5">
              <SignatureStampManager />
            </CardContent>
          </Card>
        </SettingsSection>
      )}

      <SettingsSection
        icon={Key}
        title="Account & System"
        description="Your login password, data backup, and fee balance tools."
        accent="slate"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          <Card className={SETTINGS_CARD_CLASS}>
            <CardHeader className="px-5 py-4 border-b border-border/50 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Key className="h-4 w-4" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-5">
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
                    placeholder={`Min ${user?.role === 'teacher' || user?.role === 'staff' ? 5 : 6} characters`}
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
                <Button type="submit" variant="primaryAction" className="w-full h-10" disabled={!currentPassword || !newPassword || !confirmPassword}>
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {hasSettingsFull && (
            <Card className={SETTINGS_CARD_CLASS}>
              <CardHeader className="px-5 py-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Download className="h-4 w-4" />
                  School Backup
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Export a full JSON archive of this school&apos;s data.
                </p>
                <Button variant="outline" className="w-full h-10" onClick={handleExportJSON}>
                  <Download className="w-4 h-4 mr-2" />
                  Create Backup
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Restore and reset are managed by Super Admin only.
                </p>
              </CardContent>
            </Card>
          )}

          {hasSettingsFull && (
            <Card className={cn(SETTINGS_CARD_CLASS, 'border-amber-500/20 bg-amber-500/[0.03]')}>
              <CardHeader className="px-5 py-4 border-b border-amber-500/15 bg-amber-500/5">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900 dark:text-amber-100">
                  <RefreshCw className="h-4 w-4" />
                  Arrears Sync
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Manually recalculate unpaid balances for the active term if needed.
                </p>
                <Button
                  type="button"
                  variant="primaryAction"
                  className="w-full h-10"
                  onClick={handleSyncArrears}
                  disabled={isSyncingArrears || arrearsSyncOpen}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingArrears ? 'animate-spin' : ''}`} />
                  {isSyncingArrears ? 'Syncing…' : 'Sync Arrears Now'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </SettingsSection>

      <ArrearsSyncModal
        open={arrearsSyncOpen}
        onClose={() => {
          setArrearsSyncOpen(false);
          setIsSyncingArrears(false);
        }}
        onComplete={() => void handleArrearsSyncComplete()}
      />
    </div>
  );
};

export default SettingsModule;
