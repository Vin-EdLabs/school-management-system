
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Building, PlusCircle, Pencil, Check, X } from 'lucide-react';

const SchoolManager = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [newSchool, setNewSchool] = useState({
    name: '',
    subdomain: '',
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
  });

  const [editingSchoolId, setEditingSchoolId] = useState<number | null>(null);
  const [editingSubdomain, setEditingSubdomain] = useState('');

  const getSubdomainUrl = (slug: string) => {
    const hostname = window.location.hostname.toLowerCase();
    const protocol = window.location.protocol; // http: or https:
    
    // Local development options (e.g., localhost:8080 or lvh.me:8080)
    if (hostname.includes('localhost') || hostname === '127.0.0.1' || hostname === '::1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${slug}.localhost${port}`;
    }
    
    if (hostname.endsWith('.lvh.me')) {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${slug}.lvh.me${port}`;
    }

    // Render domain resolution: tenant.scholarnerve.onrender.com
    if (hostname.endsWith('.onrender.com')) {
      const baseDomain = hostname.replace(/^[a-z0-9-]+\./, ''); // Strip any existing subdomain
      return `${protocol}//${slug}.${baseDomain}`;
    }

    // Production apex custom domain: tenant.scholarnerve.com
    const baseDomain = hostname.includes('scholarnerve.com') ? 'scholarnerve.com' : hostname.replace(/^[a-z0-9-]+\./, '');
    return `${protocol}//${slug}.${baseDomain}`;
  };

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
      await apiService.post('/schools', newSchool, { skipTenant: true });
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

  const handleUpdateSubdomain = async (id: number) => {
    try {
      await apiService.put(`/schools/${id}`, { 
        subdomain: editingSubdomain || null,
        slug: editingSubdomain || null 
      });
      toast({
        title: 'Success',
        description: 'School subdomain updated.',
      });
      setEditingSchoolId(null);
      fetchSchools();
    } catch (error: any) {
      console.error('Failed to update subdomain:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subdomain.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <Card className="xl:col-span-2 shadow-sm">
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <Building className="w-4 h-4" />
            <span>Manage Schools</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Existing Schools</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {schools.map((school) => {
                const loginUrl = school.subdomain
                  ? getSubdomainUrl(school.subdomain)
                  : `${window.location.origin}/school/${school.id}`;

                return (
                  <li key={school.id} className="flex flex-col gap-2.5 p-3 bg-muted/30 border border-border rounded-xl hover:border-blue-500/30 transition-all group shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-foreground text-sm block">{school.name}</span>
                        {editingSchoolId === school.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Input 
                              value={editingSubdomain}
                              onChange={(e) => setEditingSubdomain(e.target.value)}
                              placeholder="new-subdomain"
                              className="h-8 text-xs font-mono"
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-500/10" onClick={() => handleUpdateSubdomain(school.id)}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-500/10" onClick={() => setEditingSchoolId(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground font-mono opacity-70">
                              SUBDOMAIN: {school.subdomain || 'N/A'}
                            </p>
                            <button 
                              onClick={() => { setEditingSchoolId(school.id); setEditingSubdomain(school.subdomain || ''); }}
                              className="text-muted-foreground hover:text-blue-500 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg"
                          onClick={() => window.open(loginUrl, '_blank')}
                        >
                          Open
                        </Button>
                      </div>
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

      <Card className="shadow-sm">
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center space-x-2 text-base">
            <PlusCircle className="w-4 h-4" />
            <span>Create New School</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <form onSubmit={handleCreateSchool} className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">School Name</Label>
                <Input id="name" name="name" value={newSchool.name} onChange={handleInputChange} placeholder="St. Marys Academy" className="h-9 bg-background border-border" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subdomain" className="text-sm font-semibold">Subdomain (Slug)</Label>
                <Input id="subdomain" name="subdomain" value={newSchool.subdomain} onChange={handleInputChange} placeholder="st-marys" className="h-9 bg-background border-border" />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Admin Credentials</h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="adminUsername" className="text-sm font-semibold">Username</Label>
                  <Input id="adminUsername" name="adminUsername" value={newSchool.adminUsername} onChange={handleInputChange} placeholder="admin_stmarys" className="h-9 bg-background border-border" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail" className="text-sm font-semibold">Email</Label>
                  <Input id="adminEmail" name="adminEmail" type="email" value={newSchool.adminEmail} onChange={handleInputChange} placeholder="admin@school.com" className="h-9 bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword" className="text-sm font-semibold">Password</Label>
                  <Input id="adminPassword" name="adminPassword" type="password" value={newSchool.adminPassword} onChange={handleInputChange} placeholder="••••••••" className="h-9 bg-background border-border" required />
                </div>
              </div>
            </div>

            <Button type="submit" variant="primaryAction" className="w-full h-9 rounded-xl">
              Create School Record
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolManager;
