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
    <div className="h-screen flex bg-[#020617] overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Left Panel: Cinematic Branding (60% width on Desktop) */}
      <div className="hidden lg:flex relative w-[60%] flex-col justify-between p-12 overflow-hidden">
        {/* Deep Multi-layered Gradient Background */}
        <div className="absolute inset-0 bg-[#020617]" />
        <div 
          className="absolute inset-0 opacity-30 transition-colors duration-1000"
          style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(0,0,0,0.4),transparent_70%)]" />
        
        {/* Dynamic Animated Orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '3s' }} />

        {/* Top Section: Navigation & Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div 
              className="w-12 h-12 backdrop-blur-2xl rounded-xl flex items-center justify-center border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden group transition-all"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              {tenant?.logo_url ? (
                <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              ) : (
                <GraduationCap className="w-6 h-6 text-white/90" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white font-outfit uppercase">{schoolName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.25em]">Institutional Hub</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-all text-xs font-semibold group bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back to Website
          </button>
        </div>

        {/* Center Content: Value Proposition */}
        <div className="relative z-10 max-w-xl mt-12 animate-in fade-in slide-in-from-left duration-1000">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Enterprise Platform</span>
          </div>
          
          <h2 className="text-5xl font-black text-white leading-[1.05] tracking-tight mb-8 font-outfit">
            Mastery over your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/30">Academic Universe.</span>
          </h2>
          
          <p className="text-lg text-slate-400 leading-relaxed font-medium mb-12 max-w-md">
            Seamlessly coordinate every aspect of your institution with precision-engineered administrative tools.
          </p>

          <div className="grid grid-cols-2 gap-5">
            <div className="group p-6 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/[0.06] transition-all duration-500">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/80 mb-4 group-hover:scale-110 transition-transform group-hover:text-white">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-base mb-1 font-outfit">Secure Access</h3>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">End-to-end encrypted protocols for sensitive data protection.</p>
            </div>
            <div className="group p-6 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/[0.06] transition-all duration-500">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/80 mb-4 group-hover:scale-110 transition-transform group-hover:text-white">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-base mb-1 font-outfit">Real-time Insights</h3>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">Instant analytics and reporting for informed decision making.</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Footer Info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/5 pt-8 mt-auto animate-in fade-in slide-in-from-bottom duration-1000">
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.3em]">Powered by <span className="text-white/50">SCHOLARNERVE</span></p>
          <div className="flex items-center gap-4">
            <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">© 2026 Core Infrastructure</span>
            <div className="flex gap-2">
              <div className="w-1 h-1 bg-white/20 rounded-full" />
              <div className="w-1 h-1 bg-white/20 rounded-full" />
              <div className="w-1 h-1 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Dark, Focused Form (40% width on Desktop) */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center items-center p-6 md:p-16 relative bg-[#0f172a] border-l border-white/5">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }} />
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="lg:hidden absolute top-8 left-8 right-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden">
              {tenant?.logo_url ? (
                <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
              ) : (
                <GraduationCap className="w-5 h-5 text-white" />
              )}
            </div>
            <h1 className="font-bold text-lg text-white font-outfit uppercase tracking-tight">{schoolName}</h1>
          </div>
          <button onClick={() => navigate('/')} className="text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full max-w-sm space-y-10 relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-white tracking-tight text-center lg:text-left font-outfit">Sign In</h2>
            <p className="text-slate-500 font-medium text-base text-center lg:text-left">Welcome back. Enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                Authorized Identity
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
                  className="pl-12 h-14 rounded-xl border-white/10 bg-slate-800/40 text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-base font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <Label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Secure Password
                </Label>
              </div>
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
                  className="pl-12 h-14 rounded-xl border-white/10 bg-slate-800/40 text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-base font-medium"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-14 rounded-xl text-white font-bold text-base shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group border-0"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Verify Credentials
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>
            </div>
          </form>

          <div className="space-y-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-[9px] uppercase">
                <span className="bg-[#0f172a] px-3 text-slate-600 font-bold tracking-[0.2em]">End-to-End Encrypted</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-500 font-medium leading-loose">
                Forgot your access details? <br />
                <button className="text-white/80 hover:text-white hover:underline transition-all mt-1 font-bold">Contact System Administrator</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
