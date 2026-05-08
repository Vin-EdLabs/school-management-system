
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
      const response = await apiService.get<any[]>('/schools');
      setSchools(Array.isArray(response) ? response : []);
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
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schools.map((school) => {
                const isSubdomain = !!school.subdomain;
                const loginSlug = school.subdomain || school.id;
                const urlPrefix = isSubdomain ? 'sch' : 'school';
                const loginUrl = `${window.location.origin}/${urlPrefix}/${loginSlug}`;
                
                return (
                  <li key={school.id} className="flex flex-col gap-3 p-4 bg-muted/30 border border-border rounded-xl hover:border-blue-500/30 transition-all group shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-foreground text-lg block">{school.name}</span>
                        <p className="text-xs text-muted-foreground font-mono mt-1 opacity-70">
                          SUBDOMAIN: {school.subdomain || 'N/A'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg"
                        onClick={() => window.open(`/${urlPrefix}/${loginSlug}`, '_blank')}
                      >
                        Open
                      </Button>
                    </div>
                    <div className="bg-background/50 p-2 rounded-lg border border-border/50">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                        Portal Login URL
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 truncate font-mono">
                        {loginUrl}
                      </p>
                    </div>
                  </li>
                );
              })}
              {schools.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-border rounded-xl">
                  <p className="text-muted-foreground italic">No schools registered yet</p>
                </div>
              )}
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
          <form onSubmit={handleCreateSchool} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">School Name</Label>
                <Input id="name" name="name" value={newSchool.name} onChange={handleInputChange} placeholder="St. Marys Academy" className="bg-background border-border" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subdomain" className="text-sm font-semibold">Subdomain (Slug)</Label>
                <Input id="subdomain" name="subdomain" value={newSchool.subdomain} onChange={handleInputChange} placeholder="st-marys" className="bg-background border-border" />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Admin Credentials</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="adminUsername" className="text-sm font-semibold">Username</Label>
                  <Input id="adminUsername" name="adminUsername" value={newSchool.adminUsername} onChange={handleInputChange} placeholder="admin_stmarys" className="bg-background border-border" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail" className="text-sm font-semibold">Email</Label>
                  <Input id="adminEmail" name="adminEmail" type="email" value={newSchool.adminEmail} onChange={handleInputChange} placeholder="admin@school.com" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword" className="text-sm font-semibold">Password</Label>
                  <Input id="adminPassword" name="adminPassword" type="password" value={newSchool.adminPassword} onChange={handleInputChange} placeholder="••••••••" className="bg-background border-border" required />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-500/20">
              Create School Record
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolManager;
