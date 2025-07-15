
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { GraduationCap, Lock, User, UserCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
        description: "Invalid username or password",
        variant: "destructive",
      });
    }
  };

  const roleDisplayNames = {
    'administrator': 'Administrator',
    'finance': 'Finance Manager',
    'super-admin': 'Super Admin'
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-6 pb-8">
            {/* School Branding */}
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-gray-800 mb-1">
                  Rosa Gardens School
                </CardTitle>
                <p className="text-gray-500 text-sm font-medium">Management System</p>
              </div>
            </div>

            {/* TechNerve Branding */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                  <span className="text-xs font-bold text-white">T</span>
                </div>
                <span className="text-sm text-gray-600 font-medium">Powered by TechNerve</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
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
                      <SelectItem value="super-admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                Sign In
              </Button>
            </form>

            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 font-medium mb-2">Default Login Credentials</p>
              <div className="space-y-1 text-sm">
                <p><span className="font-semibold text-gray-700">Username:</span> <code className="bg-white px-2 py-1 rounded text-blue-600">admin</code></p>
                <p><span className="font-semibold text-gray-700">Password:</span> <code className="bg-white px-2 py-1 rounded text-blue-600">admin123</code></p>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-2 font-medium">Role Descriptions:</p>
              <div className="space-y-1 text-xs text-gray-500">
                <p><strong>Administrator:</strong> Students, Teachers, Classes</p>
                <p><strong>Finance:</strong> Financial Dashboard, Fees, Income, Expenses</p>
                <p><strong>Super Admin:</strong> Full system access</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
