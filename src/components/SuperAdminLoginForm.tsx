import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Lock, User, ArrowLeft, Shield, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const SuperAdminLoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const success = await login(username, password, 'super-admin', undefined);
      if (success) {
        toast({ title: 'Login Successful', description: 'Welcome to Super Admin Panel' });
      } else {
        toast({
          title: 'Login Failed',
          description: 'Invalid Super Admin credentials',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error?.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-screen flex bg-[#020617] overflow-hidden font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* Left Panel: Security & Authority Panel */}
      <div className="hidden lg:flex relative w-1/2 flex-col justify-between p-12 overflow-hidden">
        {/* Deep Multi-layered Gradient Background */}
        <div className="absolute inset-0 bg-[#020617]" />
        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-emerald-600 via-teal-900 to-[#020617]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05),transparent_50%)]" />
        
        {/* Dynamic Animated Orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '3s' }} />

        {/* Top Section: Navigation & Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 backdrop-blur-2xl rounded-xl flex items-center justify-center border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] bg-emerald-500/10">
              <GraduationCap className="w-6 h-6 text-white/90" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white font-outfit uppercase">TECHNERVE</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.25em]">Super Admin Core</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center Content: Value Proposition */}
        <div className="relative z-10 max-w-xl mt-12 animate-in fade-in slide-in-from-left duration-1000">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Authorized Access Only</span>
          </div>
          
          <h2 className="text-5xl font-black text-white leading-[1.05] tracking-tight mb-8 font-outfit">
            Command Center for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/30">Educational Infrastructure.</span>
          </h2>
          
          <p className="text-lg text-slate-400 leading-relaxed font-medium mb-12 max-w-md">
            Manage global school parameters, tenant environments, and core security protocols with absolute control.
          </p>

          <div className="grid grid-cols-2 gap-5">
            <div className="group p-6 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/[0.06] transition-all duration-500">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/80 mb-4 group-hover:scale-110 transition-transform group-hover:text-white">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-base mb-1 font-outfit">Encrypted Core</h3>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">256-bit military grade encryption for all management tasks.</p>
            </div>
            <div className="group p-6 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/[0.06] transition-all duration-500">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/80 mb-4 group-hover:scale-110 transition-transform group-hover:text-white">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-base mb-1 font-outfit">Audit Trails</h3>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">Comprehensive logging of every administrative action.</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Footer Info */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/5 pt-8 mt-auto animate-in fade-in slide-in-from-bottom duration-1000">
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.3em]">System Version <span className="text-white/50">4.2.0-PREMIUM</span></p>
          <div className="flex items-center gap-4">
            <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">© 2026 Technerve Security</span>
          </div>
        </div>
      </div>

      {/* Right Panel: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 md:p-16 relative bg-[#0f172a] border-l border-white/5">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }} />
        
        {/* Mobile Header */}
        <div className="lg:hidden absolute top-8 left-8 right-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="font-bold text-lg text-white font-outfit uppercase tracking-tight">TECHNERVE</h1>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-10 relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-white tracking-tight text-center lg:text-left font-outfit">Admin Portal</h2>
            <p className="text-slate-500 font-medium text-base text-center lg:text-left">Sign in to manage institutional infrastructure.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                Admin Username
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-4.5 w-4.5 text-slate-600 group-focus-within:text-emerald-400 transition-colors" />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-12 h-14 rounded-xl border-white/10 bg-slate-800/40 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all text-base font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                Security Password
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4.5 w-4.5 text-slate-600 group-focus-within:text-emerald-400 transition-colors" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 h-14 rounded-xl border-white/10 bg-slate-800/40 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all text-base font-medium"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-14 rounded-xl text-white font-bold text-base shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group border-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Initialize Access
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>
            </div>
          </form>

          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLoginForm;
