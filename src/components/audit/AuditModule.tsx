
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAudit } from '../../contexts/AuditContext';
import { Trash2, Search, Filter, Calendar, User, Activity } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AuditModule = () => {
  const { auditLogs, deleteAuditLog, clearAllLogs } = useAudit();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.reason?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || log.actionType === filterType;
    const matchesModule = filterModule === 'all' || log.module === filterModule;

    return matchesSearch && matchesType && matchesModule;
  });

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case 'Login': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Edit': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
      case 'Delete': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  const uniqueModules = [...new Set(auditLogs.map(log => log.module))];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Track all system activities and changes</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Clear All Logs
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear All Audit Logs</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Are you sure you want to delete all audit logs? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline">Cancel</Button>
                <Button variant="destructive" onClick={clearAllLogs}>
                  Clear All Logs
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                <p className="text-2xl font-bold text-foreground">{auditLogs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Logins Today</p>
                <p className="text-2xl font-bold text-foreground">
                  {auditLogs.filter(log => 
                    log.actionType === 'Login' && 
                    new Date(log.timestamp).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Edits Today</p>
                <p className="text-2xl font-bold text-foreground">
                  {auditLogs.filter(log => 
                    log.actionType === 'Edit' && 
                    new Date(log.timestamp).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Deletions Today</p>
                <p className="text-2xl font-bold text-foreground">
                  {auditLogs.filter(log => 
                    log.actionType === 'Delete' && 
                    new Date(log.timestamp).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username, module, item, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="Login">Login</SelectItem>
                <SelectItem value="Edit">Edit</SelectItem>
                <SelectItem value="Delete">Delete</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {uniqueModules.map(module => (
                  <SelectItem key={module} value={module}>{module}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({filteredLogs.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border border-border rounded-lg p-4 hover:bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge className={getActionBadgeColor(log.actionType)}>
                        {log.actionType}
                      </Badge>
                       <div>
                        <div className="font-medium text-foreground">
                          {log.itemName ? `${log.module}: ${log.itemName}` : log.module}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          by {log.username} ({log.role}) • {log.timestamp.toLocaleString()}
                        </div>
                        {log.reason && (
                          <div className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">Reason:</span> {log.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAuditLog(log.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
               {filteredLogs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs found matching your criteria.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditModule;
