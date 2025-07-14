
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { Search, TrendingUp } from 'lucide-react';

const ViewAllIncome = () => {
  const { income } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const filteredIncome = income.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.receivedBy.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = filterSource === '' || item.source === filterSource;

    return matchesSearch && matchesSource;
  });

  const totalAmount = filteredIncome.reduce((sum, item) => sum + item.amount, 0);
  const uniqueSources = [...new Set(income.map(item => item.source))];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>All Income ({filteredIncome.length})</span>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            Total: GHS {totalAmount.toLocaleString()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by source or received by..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Sources</SelectItem>
              {uniqueSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Income Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Received By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncome.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {income.length === 0 
                      ? "No income records found. Add your first income record to get started."
                      : "No income records found matching your criteria"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredIncome.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.source}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-green-600">
                        GHS {item.amount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell>{item.receivedBy}</TableCell>
                    <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {filteredIncome.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredIncome.length} of {income.length} income records
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ViewAllIncome;
