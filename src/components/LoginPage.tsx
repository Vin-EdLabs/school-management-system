
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
      // Role is now determined by the backend based on credentials
      const success = await login(username, password, 'administrator', tenantId);
      if (success) {
        toast({
          title: "Login Successful",
          description: `Welcome to ${schoolName} Management System`,
        });
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid username or password",
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

  return (
    <div className="h-screen grid grid-cols-1 md:grid-cols-2 bg-white overflow-hidden font-sans">
      {/* Left Panel: Branding & Information */}
      <div className="hidden md:flex relative flex-col justify-between p-12 bg-gradient-to-br from-blue-600 to-purple-700 text-white overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{schoolName}</h1>
              <p className="text-blue-100/80 text-sm font-medium uppercase tracking-widest">Portal</p>
            </div>
          </div>

          <div className="space-y-8 max-w-md">
            <div>
              <h2 className="text-4xl font-extrabold mb-4 leading-tight">
                Streamline Your School <span className="text-blue-200">Management</span>
              </h2>
              <p className="text-lg text-blue-50/80 leading-relaxed">
                A comprehensive solution for academics, finance, and administration, powered by state-of-the-art AI.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/15 transition-colors group">
                <div className="text-blue-200 font-bold text-2xl mb-1 group-hover:scale-110 transition-transform">100%</div>
                <div className="text-xs text-blue-100 font-medium uppercase tracking-wide">Automated Payroll</div>
              </div>
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/15 transition-colors group">
                <div className="text-blue-200 font-bold text-2xl mb-1 group-hover:scale-110 transition-transform">Real-time</div>
                <div className="text-xs text-blue-100 font-medium uppercase tracking-wide">AI Assistance</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-200 mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Secure Access
            </h3>
            <p className="text-blue-50 font-medium">Log in to access your dashboard, management tools, and reports.</p>
          </div>
          <p className="text-sm text-blue-200/60 font-medium text-center">
            &copy; 2026 TECHNERVE SOLUTIONS. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 bg-slate-50 relative overflow-hidden">
         {/* Mobile Header (Hidden on Desktop) */}
         <div className="md:hidden absolute top-8 left-8 flex items-center gap-3">
             {logoUrl ? (
                <img src={logoUrl} alt="" className="w-10 h-10 object-contain" />
              ) : (
                <GraduationCap className="w-10 h-10 text-blue-600" />
              )}
              <h1 className="font-bold text-xl text-slate-800">{schoolName}</h1>
         </div>

        <div className="w-full max-w-md space-y-10 relative z-10">
          <div className="space-y-3">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-lg">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-bold text-slate-700 ml-1">
                Account Identifier
              </Label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Your username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-12 h-14 rounded-2xl border-2 border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:ring-4 focus:ring-blue-100 transition-all text-lg"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-bold text-slate-700 ml-1">
                Access Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 h-14 rounded-2xl border-2 border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:ring-4 focus:ring-blue-100 transition-all text-lg"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 rounded-2xl text-white font-bold text-lg shadow-xl shadow-blue-200 hover:shadow-blue-300 transition-all hover:scale-[1.01] active:scale-[0.99] mt-4"
              style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
            >
              Authenticate
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
