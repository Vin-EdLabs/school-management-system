
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useSchool } from '../../contexts/SchoolContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Settings, Key, Building, Download, Upload, RefreshCw, Receipt, GraduationCap, Copy, ExternalLink } from 'lucide-react';
import AcademicTermManager from './AcademicTermManager';
import SchoolManager from './SchoolManager';

interface SchoolSettings {
  name: string;
  address: string;
  contact: string;
  email: string;
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
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings>({
    name: 'School',
    address: 'Accra, Ghana',
    contact: '+233 XX XXX XXXX',
    email: 'info@rosagardens.edu.gh',
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
      const settings = await apiService.get('/settings');
      if (settings) {
        setSchoolInfo({
          name: settings.school_name || 'School',
          address: settings.address || '',
          contact: settings.contact || '',
          email: settings.email || '',
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
    if (newPassword.length < 6) {
      toast({ title: "Password Too Short", description: "Password must be at least 6 characters long", variant: "destructive" });
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
                  placeholder="Enter new password (min 6 characters)"
                  required
                  minLength={6}
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
                  minLength={6}
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
                  placeholder="Enter new password (min 6 characters)"
                  required
                  minLength={6}
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
                  minLength={6}
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>Data Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Export/Backup Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Download all your school data as a backup file
                </p>
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>

              <div>
                <h4 className="font-medium mb-2">Import Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Import data from a backup file
                </p>
                <Input
                  type="file"
                  accept=".json"
                  className="w-full"
                />
              </div>

              <div>
                <h4 className="font-medium mb-2 text-red-700">Reset All Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  ⚠️ Permanently delete all data and start fresh
                </p>
                <Button
                  variant="destructive"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset All Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsModule;
