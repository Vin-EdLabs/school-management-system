import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import useIncome from '@/hooks/useIncome';
import { Search } from 'lucide-react';
import React, { useState } from 'react';

interface Income {
  id: string;
  source: string;
  amount: number;
  paymentMethod: string;
  receivedBy: string;
  date: string;
  notes?: string;
}

const ViewAllIncome: React.FC = () => {
  const { income: rawIncome } = useIncome();
  const income = (rawIncome || []).map((i: any) => ({
    id: i.id ?? String(i.id),
    source: i.source || i.source_name || '',
    amount: Number(i.amount || 0),
    paymentMethod: i.paymentMethod || i.method || i.payment_method || '',
    receivedBy: i.receivedBy || i.received_by || '',
    date: i.date || i.created_at || new Date().toISOString(),
    notes: i.notes || i.description || ''
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');

  const filteredIncome = income.filter((item: Income) => {
    const matchesSearch =
      searchTerm === '' ||
      item.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.receivedBy?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSource = filterSource === 'all' || item.source === filterSource;

    return matchesSearch && matchesSource;
  });

  const totalAmount = filteredIncome.reduce((sum: number, item: Income) => sum + item.amount, 0);

  const uniqueSources: string[] = Array.from(new Set(
    income.map((item: Income) => item.source).filter((s): s is string => !!s && s.trim() !== '')
  ));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>All Income ({filteredIncome.length})</span>
          <Badge variant="outline" className="text-lg px-3 py-1">
            Total: GHS {totalAmount.toLocaleString()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
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
              <SelectItem value="all">All Sources</SelectItem>
              {uniqueSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-x-auto">
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
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No income records found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredIncome.map((item: Income) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.source}</TableCell>
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

        {filteredIncome.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredIncome.length} of {income.length} income records
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ViewAllIncome;
