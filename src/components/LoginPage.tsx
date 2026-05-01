
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTenantById, resolveLogoUrl } from '../services/tenantService';
import { useSchool } from '../contexts/SchoolContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { GraduationCap, Lock, User, UserCheck, ArrowLeft, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

const LoginPage = () => {
  const { schoolId } = useParams<{ schoolId?: string }>();
  const { schoolId: contextSchoolId } = useSchool();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="h-screen flex bg-white overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Left Panel: Cinematic Branding (60% width on Desktop) */}
      <div className="hidden lg:flex relative w-[60%] flex-col justify-between p-16 overflow-hidden">
        {/* Deep Multi-layered Gradient Background */}
        <div 
          className="absolute inset-0 bg-gradient-to-br transition-colors duration-1000"
          style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
        />
        
        {/* Dynamic Animated Orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/20 rounded-full blur-[120px] animate-pulse duration-[10000ms]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400/30 rounded-full blur-[100px] animate-pulse duration-[8000ms]" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-purple-400/20 rounded-full blur-[80px] animate-pulse duration-[12000ms]" style={{ animationDelay: '4s' }} />

        {/* Top Section: Navigation & Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl overflow-hidden group">
              {tenant?.logo_url ? (
                <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              ) : (
                <GraduationCap className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">{schoolName}</h1>
              <div className="flex items-center gap-2">
                <span className="h-1 w-1 bg-blue-200 rounded-full animate-ping" />
                <p className="text-blue-100/70 text-[10px] font-bold uppercase tracking-[0.3em]">Institutional Portal</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-all text-sm font-bold group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Website
          </button>
        </div>

        {/* Center Content: Value Proposition */}
        <div className="relative z-10 max-w-2xl mt-12 animate-in fade-in slide-in-from-left duration-1000">
          <h2 className="text-6xl font-black text-white leading-[1.1] tracking-tight mb-8">
            The Future of <br />
            <span className="text-white/60">School Intelligence</span>
          </h2>
          <p className="text-xl text-blue-50/80 leading-relaxed font-medium mb-12 max-w-lg">
            Empower your institution with real-time analytics, automated workflows, and premium AI assistance.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div className="group p-6 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 hover:bg-white/10 transition-all duration-500 cursor-default">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-blue-200 mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1 uppercase tracking-tight">Secure</h3>
              <p className="text-blue-100/60 text-xs font-medium">Enterprise-grade security for your academic data.</p>
            </div>
            <div className="group p-6 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 hover:bg-white/10 transition-all duration-500 cursor-default">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-200 mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1 uppercase tracking-tight">Automated</h3>
              <p className="text-blue-100/60 text-xs font-medium">Streamline payroll and grading in seconds.</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Footer Info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-8 mt-auto animate-in fade-in slide-in-from-bottom duration-1000">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-200 animate-bounce" />
            <p className="text-sm font-bold text-white/80">Powered by SCHOLARNERVE AI</p>
          </div>
          <p className="text-xs text-white/40 font-medium tracking-widest uppercase">&copy; 2026 All Rights Reserved</p>
        </div>
      </div>

      {/* Right Panel: Clean, Focused Form (40% width on Desktop) */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center items-center p-8 md:p-16 relative bg-slate-50">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#2563eb 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center overflow-hidden">
            {tenant?.logo_url ? (
              <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-6 h-6 text-indigo-600" />
            )}
          </div>
          <h1 className="font-bold text-xl text-slate-900">{schoolName}</h1>
        </div>

        <div className="w-full max-w-sm space-y-12 relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="space-y-4">
            <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-none">Sign in</h2>
            <p className="text-slate-500 font-medium text-lg">Enter your access credentials below.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="username" className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Account ID / Email
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="superadmin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-12 h-16 rounded-[24px] border-2 border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:border-indigo-600 focus:ring-8 focus:ring-indigo-600/5 transition-all text-lg font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Label htmlFor="password" className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Access Password
                </Label>
                <button type="button" className="text-[11px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors">
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 h-16 rounded-[24px] border-2 border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:border-indigo-600 focus:ring-8 focus:ring-indigo-600/5 transition-all text-lg font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                className="w-full h-16 rounded-[24px] text-white font-black text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Authenticate
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-50 px-4 text-slate-400 font-bold tracking-widest">Security Verified</span>
                </div>
              </div>
            </div>
          </form>

          <p className="text-center text-sm text-slate-500 font-medium pt-4">
            Don't have an account? <br />
            <button className="text-indigo-600 font-bold hover:underline mt-1">Contact your administrator</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
