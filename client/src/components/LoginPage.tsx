import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Select removed — role selection not required
import ChangePasswordDialog from '@/components/auth/ChangePasswordDialog';
import { toast } from '@/hooks/use-toast';
import { Lock, User } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);

  const loginMutation = useLogin();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    loginMutation.mutate({ username, password }, {
      onSuccess: (res: any) => {
        toast({ title: 'Login Successful', description: `Welcome ${res?.user?.username ?? username}` });

        // Check if password change is required
        if (res?.user?.passwordChanged === false) {
          setRequirePasswordChange(true);
          setShowPasswordChange(true);
        } else {
          // Redirect to dashboard route
          navigate('/dashboard', { replace: true });
        }
      },
      onError: (err: any) => {
        toast({ title: 'Login Failed', description: err?.message ?? 'Invalid credentials', variant: 'destructive' });
      }
    });
  };

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChange(false);
    setRequirePasswordChange(false);
    toast({ title: 'Success', description: 'Password changed successfully. You can now access the dashboard.' });
    navigate('/dashboard', { replace: true });
  };


  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden">
      <div className="w-screen h-full bg-white/95 shadow-xl rounded-none overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left column - branding & selected role info (logo above title, centered vertically) */}
        <div className="hidden md:flex flex-col justify-center p-10 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg">
              <img src="/rosa.png" alt="Rosa Gardens Logo" className="w-16 h-16" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Rosa Gardens School</h1>
              <p className="text-sm opacity-90">Management System</p>
            </div>

            {/* Role info removed */}
          </div>

          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 flex items-center justify-center">
                <span className="text-xs font-bold"><img src="/favicon.ico" alt="" /></span>
              </div>
              <div className="text-sm">Powered by TechNerve</div>
            </div>
          </div>
        </div>

        {/* Right column - form */}
        <div className="p-8 flex flex-col justify-center">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-center">Login</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="username" className="text-sm font-medium text-gray-700">Username</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input id="username" type="text" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-10 h-11 border-gray-200" required />
              </div>
            </div>

            {/* Role selection removed - not required */}

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11 border-gray-200" required />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold">Sign In</Button>
          </form>

          {/* Removed sample role credentials panel */}
        </div>
      </div>

      <ChangePasswordDialog
        open={showPasswordChange}
        isRequired={requirePasswordChange}
        onSuccess={handlePasswordChangeSuccess}
      />
    </div>
  );
};

export default LoginPage;
