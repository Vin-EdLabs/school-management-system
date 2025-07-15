
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Settings, Key, Calendar, Users, Download, Building, Upload, RefreshCw } from 'lucide-react';

const SettingsModule = () => {
  const { changePassword } = useAuth();
  const { students, teachers, classes, payments, income, expenses } = useData();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [schoolInfo, setSchoolInfo] = useState({
    name: 'Rosa Gardens School',
    address: 'Accra, Ghana',
    contact: '+233 XX XXX XXXX',
    email: 'info@rosagardens.edu.gh'
  });
  const [academicSettings, setAcademicSettings] = useState({
    currentYear: '2024',
    currentTerm: 'Term 1 2024'
  });

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

  const handleSchoolInfoUpdate = () => {
    // Save to localStorage or context
    localStorage.setItem('schoolInfo', JSON.stringify(schoolInfo));
    toast({
      title: "School Information Updated",
      description: "School details have been saved successfully",
    });
  };

  const handleAcademicUpdate = () => {
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
      exportDate: new Date().toISOString()
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
        if (importedData.students && importedData.teachers) {
          localStorage.setItem('rosaGardensData', JSON.stringify({
            students: importedData.students,
            teachers: importedData.teachers,
            classes: importedData.classes || [],
            feeStructures: importedData.feeStructures || [],
            payments: importedData.payments || [],
            income: importedData.income || [],
            expenses: importedData.expenses || []
          }));
          
          toast({
            title: "Data Imported",
            description: "Data has been imported successfully. Please refresh the page.",
          });
        } else {
          throw new Error('Invalid data format');
        }
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Failed to import data. Please check the file format.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  const resetAllData = () => {
    if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
      localStorage.removeItem('rosaGardensData');
      toast({
        title: "Data Reset",
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
                  placeholder="Enter new password"
                  required
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
                />
              </div>
              <Button type="submit" className="w-full">
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Current Academic Year</Label>
                <Select value={academicSettings.currentYear} onValueChange={(value) => setAcademicSettings({...academicSettings, currentYear: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Current Term</Label>
                <Select value={academicSettings.currentTerm} onValueChange={(value) => setAcademicSettings({...academicSettings, currentTerm: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Term 1 2024">Term 1 2024</SelectItem>
                    <SelectItem value="Term 2 2024">Term 2 2024</SelectItem>
                    <SelectItem value="Term 3 2024">Term 3 2024</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAcademicUpdate} className="w-full">
                Update Academic Settings
              </Button>
            </div>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>School Name</Label>
                <Input 
                  value={schoolInfo.name}
                  onChange={(e) => setSchoolInfo({...schoolInfo, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input 
                  value={schoolInfo.address}
                  onChange={(e) => setSchoolInfo({...schoolInfo, address: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact</Label>
                <Input 
                  value={schoolInfo.contact}
                  onChange={(e) => setSchoolInfo({...schoolInfo, contact: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  value={schoolInfo.email}
                  onChange={(e) => setSchoolInfo({...schoolInfo, email: e.target.value})}
                />
              </div>
              <Button onClick={handleSchoolInfoUpdate} className="w-full">
                Update School Info
              </Button>
            </div>
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
                <h4 className="font-medium mb-2">Reset All Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Clear all data and start fresh
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
