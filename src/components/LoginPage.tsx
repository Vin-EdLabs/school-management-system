import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTenantById, resolveLogoUrl } from '../services/tenantService';
import { useSchool } from '../contexts/SchoolContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { GraduationCap, Lock, User, UserCheck, ArrowLeft, ShieldCheck, Zap, Sparkles, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { useTheme } from '../contexts/ThemeContext';

const LoginPage = () => {
  const { schoolId } = useParams<{ schoolId?: string }>();
  const { schoolId: contextSchoolId } = useSchool();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tenant, setTenant] = useState<{ name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null } | null>(null);
  const { login } = useAuth();
  const { theme } = useTheme();

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

  const primaryColor = tenant?.primary_color || '#2563eb';
  const secondaryColor = tenant?.secondary_color || '#7c3aed';
  const schoolName = tenant?.name || 'School';
  const logoUrl = resolveLogoUrl(tenant?.logo_url || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617] overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-6 animate-in fade-in zoom-in duration-700">
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row">
          
          {/* Left Side: Branding */}
          <div className="w-full md:w-[40%] p-8 md:p-12 flex flex-col justify-between items-center md:items-start relative overflow-hidden border-b md:border-b-0 md:border-r border-white/10">
            {/* Subtle Gradient Backdrop for branding side */}
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
            />
            
            <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
              <div 
                className="w-16 h-16 mb-8 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/10 shadow-xl overflow-hidden group transition-all"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                {tenant?.logo_url ? (
                  <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <GraduationCap className="w-8 h-8 text-white/90" />
                )}
              </div>
              
              <h1 className="text-3xl font-black tracking-tight text-white font-outfit uppercase leading-tight mb-2">
                {schoolName}
              </h1>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Authorized Portal</p>
              </div>
            </div>

            <div className="relative z-10 mt-12 md:mt-auto">
              <p className="text-slate-500 text-xs font-medium leading-relaxed max-w-[200px] text-center md:text-left">
                Precision tools for modern educational administration.
              </p>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="flex-1 p-8 md:p-12">
            <div className="mb-10">
              <h2 className="text-3xl font-black text-white tracking-tight font-outfit mb-2">Sign In</h2>
              <p className="text-slate-500 font-medium text-sm">Enter your credentials to access the workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Identity
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-4.5 w-4.5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-12 h-14 rounded-2xl border-white/10 bg-slate-800/40 text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-base font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Password
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4.5 w-4.5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 h-14 rounded-2xl border-white/10 bg-slate-800/40 text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-base font-medium"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group border-0"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Verify & Access
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </span>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <button className="text-[10px] text-slate-500 hover:text-white transition-colors font-bold uppercase tracking-widest">
                Support
              </button>
              <button 
                onClick={() => navigate('/')}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors font-bold uppercase tracking-widest flex items-center gap-2"
              >
                <ArrowLeft className="w-3 h-3" />
                Public Site
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Footer - Fixed at Bottom */}
      <div className="absolute bottom-8 left-0 right-0 z-20 flex flex-col items-center gap-2 animate-in fade-in duration-1000 delay-500">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">Powered by TECHNERVE</p>
        <p className="text-[8px] text-white/10 font-bold uppercase tracking-widest">© 2026 Platform Infrastructure</p>
      </div>
    </div>
  );
};

export default LoginPage;
