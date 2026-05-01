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
    <div className="h-screen flex bg-slate-950 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Left Panel: Cinematic Branding (60% width on Desktop) */}
      <div className="hidden lg:flex relative w-[60%] flex-col justify-between p-16 overflow-hidden">
        {/* Deep Multi-layered Gradient Background */}
        <div className="absolute inset-0 bg-slate-900" />
        <div 
          className="absolute inset-0 opacity-40 transition-colors duration-1000"
          style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_20%,rgba(0,0,0,0.4),transparent_70%)]" />
        
        {/* Dynamic Animated Orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10000ms' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8000ms', animationDelay: '2s' }} />

        {/* Top Section: Navigation & Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl overflow-hidden group transition-all"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              {tenant?.logo_url ? (
                <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              ) : (
                <GraduationCap className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">{schoolName}</h1>
              <div className="flex items-center gap-2 text-white/50">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Institutional Hub</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-all text-sm font-bold group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Website
          </button>
        </div>

        {/* Center Content: Value Proposition */}
        <div className="relative z-10 max-w-2xl mt-12 animate-in fade-in slide-in-from-left duration-1000">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-inner">
            <ShieldCheck className="w-10 h-10 text-white opacity-80" />
          </div>
          <h2 className="text-6xl font-black text-white leading-[1.1] tracking-tight mb-8">
            Precision <br />
            <span className="text-white/40">Education Control</span>
          </h2>
          <p className="text-xl text-slate-400 leading-relaxed font-medium mb-12 max-w-lg">
            Manage your academic ecosystem with enterprise-grade tools designed for modern institutions.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div className="group p-8 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all duration-500 cursor-default">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1 uppercase tracking-tight">Verified</h3>
              <p className="text-slate-500 text-xs font-medium">End-to-end encrypted management portal.</p>
            </div>
            <div className="group p-8 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all duration-500 cursor-default">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1 uppercase tracking-tight">Protected</h3>
              <p className="text-slate-500 text-xs font-medium">Multi-layer authentication protocols.</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Footer Info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/5 pt-8 mt-auto animate-in fade-in slide-in-from-bottom duration-1000">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white/30 animate-pulse" />
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Powered by SCHOLARNERVE</p>
          </div>
          <p className="text-[10px] text-white/20 font-bold tracking-[0.4em] uppercase">&copy; 2026 SECURITY CORE</p>
        </div>
      </div>

      {/* Right Panel: Dark, Focused Form (40% width on Desktop) */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center items-center p-8 md:p-16 relative bg-slate-900 border-l border-white/5 transition-colors duration-500">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-800 rounded-xl shadow-xl border border-white/10 flex items-center justify-center overflow-hidden">
            {tenant?.logo_url ? (
              <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-6 h-6 text-white" />
            )}
          </div>
          <h1 className="font-bold text-xl text-white uppercase tracking-tight">{schoolName}</h1>
        </div>

        <div className="w-full max-w-sm space-y-12 relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="space-y-4">
            <div className="w-14 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full mx-auto hidden lg:block" />
            <h2 className="text-5xl font-black text-white tracking-tight leading-none text-center lg:text-left">Sign In</h2>
            <p className="text-slate-500 font-medium text-lg text-center lg:text-left">Access your administrative workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="username" className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Authorized Identity
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-600 group-focus-within:text-white transition-colors" />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-12 h-16 rounded-2xl border-white/10 bg-slate-800/50 text-white placeholder:text-slate-600 focus:border-white/20 focus:ring-8 focus:ring-white/5 transition-all text-lg font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Label htmlFor="password" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Secure Password
                </Label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-600 group-focus-within:text-white transition-colors" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 h-16 rounded-2xl border-white/10 bg-slate-800/50 text-white placeholder:text-slate-600 focus:border-white/20 focus:ring-8 focus:ring-white/5 transition-all text-lg font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-6">
              <Button
                type="submit"
                className="w-full h-16 rounded-2xl text-white font-black text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group border-0"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Verify Credentials
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </span>
                <div className="absolute inset-0 bg-black/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/5" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-slate-900 px-4 text-slate-600 font-black tracking-[0.2em]">End-to-End Encrypted</span>
                </div>
              </div>
            </div>
          </form>

          <p className="text-center text-xs text-slate-600 font-bold uppercase tracking-widest pt-4 leading-loose">
            Forgot access? <br />
            <button className="text-white hover:underline mt-2">Contact System Admin</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
