
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
import React, { useState, useEffect, useCallback } from 'react';
=======
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useSchool } from '../../contexts/SchoolContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Settings, Key, Building, Download, Upload, RefreshCw, Receipt, GraduationCap, Copy, ExternalLink } from 'lucide-react';
import AcademicTermManager from './AcademicTermManager';
import SchoolManager from './SchoolManager';
=======
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useExpenses from '@/hooks/useExpenses';
import useIncome from '@/hooks/useIncome';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import { Building, Download, Key, RefreshCw, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AcademicTermManager from './AcademicTermManager';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as settingsService from '@/services/settingsService';
import * as authService from '@/services/authService';
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx

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
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
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
=======
  const { user, hasAccess, logout } = useAuth();
  const queryClient = useQueryClient();
  const { students } = useStudents();
  const { teachers } = useTeachers();
  const { classes } = useClasses();
  const { payments } = usePayments();
  const { income } = useIncome();
  const { expenses } = useExpenses();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); // Added for backend validation
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings>({
    currentYear: new Date().getFullYear().toString(),
    currentTerm: 'Term 1'
  });
  const [receiptSettings, setReceiptSettings] = useState({
    receipt_prefix: 'R',
    postal_address: '',
    contact_phone: '',
    receipt_footer: '',
    bank_details: '',
  });

<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
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
=======
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings>({
    name: '',
    address: '',
    contact: '',
    email: ''
  });

  // Load backend settings
  const { data: backendSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const resp = await settingsService.getSettings();
      return resp.data || resp;
    }
  });

  useEffect(() => {
    if (backendSettings?.school_info) {
      setSchoolInfo(backendSettings.school_info);
    } else {
      // Fallback to localStorage if backend is empty
      const saved = localStorage.getItem('schoolInfo');
      if (saved) setSchoolInfo(JSON.parse(saved));
    }
  }, [backendSettings]);

  const isSuperAdmin = hasAccess('settings');
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx

  useEffect(() => {
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
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
=======
    const savedSchoolInfo = localStorage.getItem('schoolInfo');
    const savedAcademicSettings = localStorage.getItem('academicSettings');

    if (savedSchoolInfo) {
      try {
        setSchoolInfo(JSON.parse(savedSchoolInfo));
      } catch (error) {
        console.error('Error loading school info:', error);
      }
    }

    if (savedAcademicSettings) {
      try {
        setAcademicSettings(JSON.parse(savedAcademicSettings));
      } catch (error) {
        console.error('Error loading academic settings:', error);
      }
    }
  }, []);
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx

  const dispatchSettingsChange = () => {
    window.dispatchEvent(new CustomEvent('academicSettingsChanged'));
    queryClient.invalidateQueries({ queryKey: ['settings'] });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
=======

>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
    if (newPassword !== confirmPassword) {
      toast({ title: "Password Mismatch", description: "Passwords do not match", variant: "destructive" });
      return;
    }
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
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
=======

    if (!currentPassword) {
      toast({
        title: "Current Password Required",
        description: "Please enter your current password to verify identity",
        variant: "destructive"
      });
      return;
    }

    try {
      await authService.changePassword(currentPassword, newPassword);

      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully. Please log in again.",
      });

      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');

      // Forces re-login to ensure security
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.body?.message || err.message || "Failed to change password",
        variant: "destructive"
      });
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
    }
  };

  const handleSchoolInfoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
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
=======
    if (!isSuperAdmin) return;

    try {
      await settingsService.updateSetting('school_info', schoolInfo);
      localStorage.setItem('schoolInfo', JSON.stringify(schoolInfo));

      toast({
        title: "School Information Updated",
        description: "School details have been saved successfully to the server",
      });

      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: "Failed to save school information to the server",
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
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
              <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
              <p className="text-muted-foreground">Change your password</p>
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
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
                  placeholder="Enter your current password"
=======
                  placeholder="Enter current password"
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
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

<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
  // Super-admin / Primary admin settings view
  return (
    <div className="p-6 space-y-6">
=======
  const handleExportData = () => {
    const data = {
      students,
      teachers,
      classes,
      payments,
      income,
      expenses,
      schoolInfo,
      academicSettings,
      exportDate: new Date().toISOString(),
      exportVersion: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rosa-gardens-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Data Exported",
      description: "Your data has been exported successfully",
    });
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);

        if (importedData.students && Array.isArray(importedData.students)) {
          localStorage.setItem('rosaGardensData', JSON.stringify({
            students: importedData.students,
            teachers: importedData.teachers || [],
            classes: importedData.classes || [],
            feeStructures: importedData.feeStructures || [],
            payments: importedData.payments || [],
            income: importedData.income || [],
            expenses: importedData.expenses || []
          }));

          if (importedData.schoolInfo) {
            localStorage.setItem('schoolInfo', JSON.stringify(importedData.schoolInfo));
            setSchoolInfo(importedData.schoolInfo);
          }

          if (importedData.academicSettings) {
            localStorage.setItem('academicSettings', JSON.stringify(importedData.academicSettings));
            setAcademicSettings(importedData.academicSettings);
            dispatchSettingsChange(); // Notify header of changes
          }

          toast({
            title: "Data Imported Successfully",
            description: "Data has been imported. Please refresh the page to see changes.",
          });

          event.target.value = '';
        } else {
          throw new Error('Invalid data format');
        }
      } catch (error) {
        console.error('Import error:', error);
        toast({
          title: "Import Failed",
          description: "Failed to import data. Please check the file format and try again.",
          variant: "destructive"
        });
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const resetAllData = () => {
    const isConfirmed = window.confirm(
      'Are you sure you want to reset all data? This action cannot be undone.'
    );

    if (isConfirmed) {
      localStorage.removeItem('rosaGardensData');
      localStorage.removeItem('schoolInfo');
      localStorage.removeItem('academicSettings');
      localStorage.removeItem('academicTerms');

      // Notify header of changes
      dispatchSettingsChange();

      toast({
        title: "Data Reset Complete",
        description: "All data has been reset. Please refresh the page.",
      });
    }
  };

  return (
    <div className="p-6 space-y-6 bg-transparent">
      {/* Header */}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Settings className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              System Settings
            </h1>
            <p className="text-muted-foreground text-lg">Configure system settings and preferences</p>
          </div>
        </div>
      </div>

      {/* School Management - Super-Admin only */}
      {isSuperAdmin && <SchoolManager />}

      {hasSettingsFull && <AcademicTermManager />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
=======
        {/* Password Change */}
        <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl">
          <CardHeader className="border-b border-border dark:border-slate-800">
            <CardTitle className="flex items-center space-x-2 text-xl font-bold text-foreground">
              <Key className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
              <span>Change Password</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 mt-4">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
                <Label htmlFor="currentPasswordFull">Current Password</Label>
                <Input
                  id="currentPasswordFull"
=======
                <Label htmlFor="currentPasswordMain">Current Password</Label>
                <Input
                  id="currentPasswordMain"
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
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
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
              <Button type="submit" className="w-full" disabled={!currentPassword || !newPassword || !confirmPassword}>
=======
              <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 text-white" disabled={!newPassword || !confirmPassword}>
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
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
=======
        {/* School Information */}
        <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl">
          <CardHeader className="border-b border-border dark:border-slate-800">
            <CardTitle className="flex items-center space-x-2 text-xl font-bold text-foreground">
              <Building className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <span>School Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 mt-4">
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
              <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
                Update School Information
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl">
          <CardHeader className="border-b border-border dark:border-slate-800">
            <CardTitle className="flex items-center space-x-2 text-xl font-bold text-foreground">
              <Download className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
              <span>Data Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 mt-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Export/Backup Data</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Download all your school data as a backup file
                </p>
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>

              <div>
                <h4 className="font-medium mb-2">Import Data</h4>
                <p className="text-sm text-muted-foreground mb-3">
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
                <p className="text-sm text-muted-foreground mb-3">
                  ⚠️ Permanently delete all data and start fresh
                </p>
                <Button
<<<<<<< HEAD:src/components/settings/SettingsModule.tsx
                  variant="destructive"
                  className="w-full"
=======
                  onClick={resetAllData}
                  variant="destructive"
                  className="w-full h-11 rounded-xl shadow-lg shadow-red-500/10"
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/settings/SettingsModule.tsx
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
