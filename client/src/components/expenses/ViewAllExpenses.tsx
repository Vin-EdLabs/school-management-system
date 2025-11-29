import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import useExpenses from '@/hooks/useExpenses';
import { Search, TrendingDown } from 'lucide-react';

const ViewAllExpenses = () => {
  const { expenses } = useExpenses();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('__all__');

  // Normalizers to support camelCase or snake_case API payloads
  const getTitle = (e: any) => e?.title ?? e?.name ?? '';
  const getPayee = (e: any) => e?.payeeName ?? e?.payee_name ?? e?.payee ?? '';
  const getCategory = (e: any) => e?.category ?? e?.type ?? 'Other';
  const getAmount = (e: any) => Number(e?.amount ?? e?.value ?? 0) || 0;
  const getPaymentMethod = (e: any) => e?.paymentMethod ?? e?.payment_method ?? e?.method ?? '';
  const getDate = (e: any) => new Date(e?.paymentDate ?? e?.payment_date ?? e?.date ?? Date.now());
  const getPurpose = (e: any) => e?.purpose ?? e?.description ?? '';

  const allExpenses = expenses || [];
  const filteredExpenses = allExpenses.filter((expense: any) => {
    const title = getTitle(expense).toLowerCase();
    const payee = getPayee(expense).toLowerCase();
    const category = (getCategory(expense) || '').toLowerCase();

    const matchesSearch =
      searchTerm === '' ||
      title.includes(searchTerm.toLowerCase()) ||
      payee.includes(searchTerm.toLowerCase()) ||
      category.includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === '__all__' || getCategory(expense) === filterCategory;

    return matchesSearch && matchesCategory;
  });

  const totalAmount = filteredExpenses.reduce((sum: number, expense: any) => sum + getAmount(expense), 0);
  const uniqueCategories: string[] = Array.from(new Set((allExpenses || []).map((expense: any) => String(getCategory(expense)))));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingDown className="w-5 h-5" />
            <span>All Expenses ({filteredExpenses.length})</span>
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
              placeholder="Search by title, payee, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {uniqueCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Expenses Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {expenses.length === 0
                      ? 'No expense records found. Add your first expense record to get started.'
                      : 'No expense records found matching your criteria'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense: any) => (
                  <TableRow key={expense.id ?? expense._id}>
                    <TableCell>
                      <div className="font-medium">{getTitle(expense)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategory(expense)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-red-600">
                        GHS {getAmount(expense).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>{getPayee(expense)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getPaymentMethod(expense)}</Badge>
                    </TableCell>
                    <TableCell>
                      {getDate(expense).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {getPurpose(expense) || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {filteredExpenses.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredExpenses.length} of {expenses.length} expense records
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ViewAllExpenses;
