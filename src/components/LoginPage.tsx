
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { GraduationCap, Lock, User, UserCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth, UserRole } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('administrator');
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (login(username, password, role)) {
      toast({
        title: "Login Successful",
        description: `Welcome to Rosa Gardens School Management System as ${role.replace('-', ' ')}`,
      });
    } else {
      toast({
        title: "Login Failed",
        description: "Invalid username or password for the selected role",
        variant: "destructive",
      });
    }
  };

  const roleCredentials = {
    'administrator': { password: 'admin123', description: 'Students, Teachers, Classes' },
    'finance': { password: 'finance123', description: 'Financial Dashboard, Fees, Income, Expenses' },
    'teacher': { password: 'teacher123', description: 'Classes, Attendance, Grades' },
    'super-admin': { password: 'superadmin123', description: 'Full system access' }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden">
      <div className="w-screen h-full bg-white/95 shadow-xl rounded-none overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left column - branding & selected role info (logo above title, centered vertically) */}
        <div className="hidden md:flex flex-col justify-center p-10 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Rosa Gardens School</h1>
              <p className="text-sm opacity-90">Management System</p>
            </div>

            <div className="mt-2 w-full">
              <p className="text-xs font-medium uppercase tracking-wide opacity-90">Selected Role Access:</p>
              <div className="mt-3 bg-white/10 rounded-md p-4">
                <p className="text-sm font-semibold">{role.replace('-', ' ').toUpperCase()}</p>
                <p className="text-sm opacity-90">{roleCredentials[role].description}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                <span className="text-xs font-bold">T</span>
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

            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                Role
              </Label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                  <SelectTrigger className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrator">Administrator</SelectItem>
                    <SelectItem value="finance">Finance Manager</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="super-admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11 border-gray-200" required />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold">Sign In</Button>
          </form>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-2">Login Credentials</p>
              <div className="space-y-1 text-sm">
                <p><span className="font-semibold text-gray-700">Username:</span> <code className="bg-white px-2 py-1 rounded text-blue-600">admin</code></p>
                <p><span className="font-semibold text-gray-700">Password:</span> <code className="bg-white px-2 py-1 rounded text-blue-600">{roleCredentials[role].password}</code></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
