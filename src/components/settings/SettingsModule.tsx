
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Settings, Key, Calendar, Building, Download, Upload, RefreshCw } from 'lucide-react';

interface SchoolSettings {
  name: string;
  address: string;
  contact: string;
  email: string;
}

interface AcademicSettings {
  currentYear: string;
  currentTerm: string;
}

const SettingsModule = () => {
  const { changePassword } = useAuth();
  const { students, teachers, classes, payments, income, expenses } = useData();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings>({
    name: 'Rosa Gardens School',
    address: 'Accra, Ghana',
    contact: '+233 XX XXX XXXX',
    email: 'info@rosagardens.edu.gh'
  });
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings>({
    currentYear: '2024',
    currentTerm: 'Term 1 2024'
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
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

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    changePassword(newPassword);
    
    toast({
      title: "Password Changed",
      description: "Your password has been updated successfully",
    });

    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSchoolInfoUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('schoolInfo', JSON.stringify(schoolInfo));
    toast({
      title: "School Information Updated",
      description: "School details have been saved successfully",
    });
  };

  const handleAcademicUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('academicSettings', JSON.stringify(academicSettings));
    toast({
      title: "Academic Settings Updated",
      description: "Academic year and term have been updated",
    });
  };

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
        
        // Validate the data structure
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
          
          // Also update settings if available
          if (importedData.schoolInfo) {
            localStorage.setItem('schoolInfo', JSON.stringify(importedData.schoolInfo));
            setSchoolInfo(importedData.schoolInfo);
          }
          
          if (importedData.academicSettings) {
            localStorage.setItem('academicSettings', JSON.stringify(importedData.academicSettings));
            setAcademicSettings(importedData.academicSettings);
          }
          
          toast({
            title: "Data Imported Successfully",
            description: "Data has been imported. Please refresh the page to see changes.",
          });
          
          // Reset file input
          event.target.value = '';
        } else {
          throw new Error('Invalid data format - missing or invalid students array');
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
      'Are you sure you want to reset all data? This action cannot be undone. All students, teachers, classes, and financial records will be permanently deleted.'
    );
    
    if (isConfirmed) {
      localStorage.removeItem('rosaGardensData');
      localStorage.removeItem('schoolInfo');
      localStorage.removeItem('academicSettings');
      
      toast({
        title: "Data Reset Complete",
        description: "All data has been reset. Please refresh the page.",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
            <p className="text-gray-600">Configure system settings and preferences</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Password Change */}
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
              <Button type="submit" className="w-full" disabled={!newPassword || !confirmPassword}>
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Academic Year & Term */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Academic Year & Term</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAcademicUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label>Current Academic Year</Label>
                <Select 
                  value={academicSettings.currentYear} 
                  onValueChange={(value) => setAcademicSettings({...academicSettings, currentYear: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Current Term</Label>
                <Select 
                  value={academicSettings.currentTerm} 
                  onValueChange={(value) => setAcademicSettings({...academicSettings, currentTerm: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Term 1 2024">Term 1 2024</SelectItem>
                    <SelectItem value="Term 2 2024">Term 2 2024</SelectItem>
                    <SelectItem value="Term 3 2024">Term 3 2024</SelectItem>
                    <SelectItem value="Term 1 2025">Term 1 2025</SelectItem>
                    <SelectItem value="Term 2 2025">Term 2 2025</SelectItem>
                    <SelectItem value="Term 3 2025">Term 3 2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Update Academic Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* School Information */}
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
                  onChange={(e) => setSchoolInfo({...schoolInfo, name: e.target.value})}
                  placeholder="Enter school name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolAddress">Address</Label>
                <Input 
                  id="schoolAddress"
                  value={schoolInfo.address}
                  onChange={(e) => setSchoolInfo({...schoolInfo, address: e.target.value})}
                  placeholder="Enter school address"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolContact">Contact Number</Label>
                <Input 
                  id="schoolContact"
                  value={schoolInfo.contact}
                  onChange={(e) => setSchoolInfo({...schoolInfo, contact: e.target.value})}
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
                  onChange={(e) => setSchoolInfo({...schoolInfo, email: e.target.value})}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Update School Information
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Data Management */}
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
                <Button onClick={handleExportData} variant="outline" className="w-full">
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
                  onChange={handleImportData}
                  className="w-full"
                />
              </div>

              <div>
                <h4 className="font-medium mb-2 text-red-700">Reset All Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  ⚠️ Permanently delete all data and start fresh
                </p>
                <Button 
                  onClick={resetAllData} 
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
