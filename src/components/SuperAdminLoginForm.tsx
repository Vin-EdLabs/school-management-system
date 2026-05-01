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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617] overflow-hidden font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-15 bg-gradient-to-br from-emerald-600 via-teal-900 to-[#020617]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-6 animate-in fade-in zoom-in duration-700">
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row">
          
          {/* Left Side: Branding */}
          <div className="w-full md:w-[40%] p-8 md:p-12 flex flex-col justify-between items-center md:items-start relative overflow-hidden border-b md:border-b-0 md:border-r border-white/10 bg-emerald-500/5">
            <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="w-16 h-16 mb-8 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/10 shadow-xl bg-emerald-500/10">
                <GraduationCap className="w-8 h-8 text-white/90" />
              </div>
              
              <h1 className="text-3xl font-black tracking-tight text-white font-outfit uppercase leading-tight mb-2">
                TECHNERVE
              </h1>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Super Admin Core</p>
              </div>
            </div>

            <div className="relative z-10 mt-12 md:mt-auto">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] opacity-50">
                Security Protocol 4.2.0
              </p>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="flex-1 p-8 md:p-12">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-black text-white tracking-tight font-outfit mb-2">Admin Portal</h2>
              <p className="text-slate-500 font-medium text-sm">Sign in to manage institutional infrastructure.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Admin Identity
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
                    className="pl-12 h-14 rounded-2xl border-white/10 bg-slate-800/40 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all text-base font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Security Code
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
                    className="pl-12 h-14 rounded-2xl border-white/10 bg-slate-800/40 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all text-base font-medium"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group border-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Initialize Access
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </span>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <Link to="/" className="text-[10px] text-slate-500 hover:text-white transition-colors font-bold uppercase tracking-widest flex items-center gap-2">
                <ArrowLeft className="w-3 h-3" />
                Return to Site
              </Link>
              <p className="text-[8px] text-white/10 font-bold uppercase tracking-widest">
                Authorized Use Only
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLoginForm;
