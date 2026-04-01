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
    <div className="min-h-screen flex bg-slate-950">
      {/* Left: Security branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_20%,rgba(34,197,94,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_80%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">TECHNERVE</span>
          </div>
          <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center mb-6">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Secure Admin Access</h1>
          <p className="text-slate-400 text-center max-w-xs">
            Platform administration. Authorized personnel only. All access is logged and monitored.
          </p>
          <div className="mt-10 flex items-center gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4" />
            <span>256-bit encryption</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
            <Lock className="w-4 h-4" />
            <span>Audit trail enabled</span>
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-slate-900">
        <div className="w-full max-w-sm">
          {/* TECHNERVE logo - visible on form side for mobile */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">TECHNERVE</span>
          </div>

          <h2 className="text-xl font-semibold text-white mb-1">Super Admin Portal</h2>
          <p className="text-slate-400 text-sm mb-8">Sign in to manage all schools and platform settings</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="username" className="text-slate-300 text-sm font-medium">Username</Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter Super Admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold border-0 shadow-lg shadow-emerald-500/25"
            >
              Sign In Securely
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-700">
            <Link to="/select-school">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800 w-full justify-center">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to School Login
              </Button>
            </Link>
          </div>

          <p className="text-xs text-slate-500 text-center mt-4">
            Authorized access only. Default: superadmin / superadmin123
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLoginForm;
