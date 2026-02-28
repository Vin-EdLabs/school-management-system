
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Building, PlusCircle } from 'lucide-react';

const SchoolManager = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [newSchool, setNewSchool] = useState({
    name: '',
    subdomain: '',
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
  });

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const response = await apiService.get('/schools');
      setSchools(response);
    } catch (error) {
      console.error('Failed to fetch schools:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch schools.',
        variant: 'destructive',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewSchool((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.post('/schools', newSchool);
      toast({
        title: 'Success',
        description: 'School created successfully.',
      });
      setNewSchool({
        name: '',
        subdomain: '',
        adminUsername: '',
        adminPassword: '',
        adminEmail: '',
      });
      fetchSchools(); // Refresh the list of schools
    } catch (error) {
      console.error('Failed to create school:', error);
      toast({
        title: 'Error',
        description: 'Failed to create school.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="w-5 h-5" />
            <span>Manage Schools</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h3 className="font-medium">Existing Schools</h3>
            <ul className="space-y-2">
              {schools.map((school) => (
                <li key={school.id} className="flex flex-col gap-1 p-3 border rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{school.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/school/${school.id}`, '_blank')}
                    >
                      Open
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Login URL: {window.location.origin}/school/{school.id}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PlusCircle className="w-5 h-5" />
            <span>Create New School</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSchool} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">School Name</Label>
              <Input id="name" name="name" value={newSchool.name} onChange={handleInputChange} placeholder="Enter school name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input id="subdomain" name="subdomain" value={newSchool.subdomain} onChange={handleInputChange} placeholder="Enter subdomain (optional)" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminUsername">Admin Username</Label>
              <Input id="adminUsername" name="adminUsername" value={newSchool.adminUsername} onChange={handleInputChange} placeholder="Enter admin username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Admin Password</Label>
              <Input id="adminPassword" name="adminPassword" type="password" value={newSchool.adminPassword} onChange={handleInputChange} placeholder="Enter admin password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input id="adminEmail" name="adminEmail" type="email" value={newSchool.adminEmail} onChange={handleInputChange} placeholder="Enter admin email (optional)" />
            </div>
            <Button type="submit" className="w-full">
              Create School
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolManager;
