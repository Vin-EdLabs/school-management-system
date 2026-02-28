
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTenantById, resolveLogoUrl } from '../services/tenantService';
import { useSchool } from '../contexts/SchoolContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { GraduationCap, Lock, User, UserCheck, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const LoginPage = () => {
  const { schoolId } = useParams<{ schoolId?: string }>();
  const { schoolId: contextSchoolId } = useSchool();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('administrator');
  const [tenant, setTenant] = useState<{ name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null } | null>(null);
  const { login } = useAuth();

  const tenantId = contextSchoolId ?? (schoolId ? parseInt(schoolId, 10) : undefined);

  useEffect(() => {
    if (tenantId) {
      fetchTenantById(tenantId).then((t) => {
        if (t) setTenant({ name: t.name, logo_url: t.logo_url, primary_color: t.primary_color, secondary_color: t.secondary_color });
        else setTenant(null);
      });
    } else {
      setTenant(null);
    }
  }, [tenantId]);

  const isSuperAdmin = role === 'super-admin';
  const primaryColor = tenant?.primary_color || '#2563eb';
  const secondaryColor = tenant?.secondary_color || '#7c3aed';
  const schoolName = tenant?.name || 'School';
  const logoUrl = resolveLogoUrl(tenant?.logo_url || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const success = await login(username, password, role, isSuperAdmin ? undefined : tenantId);
      if (success) {
        toast({
          title: "Login Successful",
          description: `Welcome to ${schoolName} Management System as ${role.replace('-', ' ')}`,
        });
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid username or password for the selected role",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error?.message || "An error occurred during login. Please try again.",
        variant: "destructive",
      });
    }
  };

  const roleCredentials: Record<string, string> = {
    'administrator': 'Students, Teachers, Classes',
    'finance': 'Financial Dashboard, Fees, Income, Expenses',
    'teacher': 'Classes, Attendance, Grades',
    'staff': 'Classes, Attendance, Grades (non-teaching staff)',
    'super-admin': 'Full system access',
  };

  const isStaffOrTeacher = role === 'teacher' || role === 'staff';

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Left: Background image - scaled down (zoomed out), shadow overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative h-screen overflow-hidden">
        {logoUrl ? (
          <>
            <img
              src={logoUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-75"
            />
            <div className="absolute inset-0 bg-slate-900/50 shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]" />
          </>
        ) : (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            }}
          />
        )}
        <div className="relative z-10 flex flex-col justify-center items-center p-8 w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">{schoolName}</h1>
          <p className="text-white/95 text-base drop-shadow-md">Management System</p>
          <p className="text-white/80 text-xs mt-4 drop-shadow">Powered by TECHNERVE</p>
        </div>
      </div>

      {/* Right: Login Form - compact, no scroll */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-6 lg:p-10 bg-slate-50/50 overflow-hidden">
        <div className="max-w-sm mx-auto w-full">
          {/* Round logo */}
          <div className="flex justify-center mb-6">
            {logoUrl ? (
              <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center p-1">
                <img src={logoUrl} alt="" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center bg-slate-100/80">
                <GraduationCap className="w-14 h-14 text-slate-400" />
              </div>
            )}
          </div>

          <h2 className="text-xl font-semibold text-slate-900 mb-0.5">Sign in</h2>
          <p className="text-slate-500 text-sm mb-5">Enter your credentials</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="role" className="text-sm font-medium text-slate-700">Role</Label>
              <div className="relative mt-1">
                <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                  <SelectTrigger className="pl-9 h-10 rounded-lg border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrator">Administrator</SelectItem>
                    <SelectItem value="finance">Finance Manager</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="staff">Staff (non-teaching)</SelectItem>
                    <SelectItem value="super-admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                {isStaffOrTeacher ? 'Staff ID (e.g. TCH001, STAFF001)' : 'Username'}
              </Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder={isStaffOrTeacher ? 'Enter Staff ID' : 'Enter your username'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 h-10 rounded-lg border-slate-200 bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                {isStaffOrTeacher ? 'PIN (5-digit password)' : 'Password'}
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={isStaffOrTeacher ? 'text' : 'password'}
                  inputMode={isStaffOrTeacher ? 'numeric' : undefined}
                  maxLength={isStaffOrTeacher ? 5 : undefined}
                  placeholder={isStaffOrTeacher ? 'Enter 5-digit PIN' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-10 rounded-lg border-slate-200 bg-white"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-lg text-white font-semibold text-sm shadow-md"
              style={{ backgroundColor: primaryColor }}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-2">{roleCredentials[role]}</p>
            <Link to="/select-school">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to School Select
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
