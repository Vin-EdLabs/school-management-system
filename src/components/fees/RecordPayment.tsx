import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { CreditCard, Search } from 'lucide-react';

const RecordPayment = () => {
  const { students, addPayment } = useData();
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    term: 'Term 1 2024',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = students.filter(student =>
    student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentId.includes(searchTerm)
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.studentId || !formData.amount) {
      toast({
        title: "Validation Error",
        description: "Please select student and enter amount",
        variant: "destructive"
      });
      return;
    }

    const student = students.find(s => s.id === formData.studentId);
    addPayment({
      ...formData,
      amount: parseFloat(formData.amount)
    });

    toast({
      title: "Payment Recorded",
      description: `GHS ${formData.amount} payment recorded for ${student?.firstName} ${student?.lastName}`,
    });

    setFormData({
      studentId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      term: 'Term 1 2024',
      notes: ''
    });
    setSearchTerm('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="w-5 h-5" />
          <span>Record Payment</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="studentSearch">Search Student</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="studentSearch"
                placeholder="Search by name or student ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => {
                      setFormData(prev => ({...prev, studentId: student.id}));
                      setSearchTerm(`${student.firstName} ${student.lastName} - ${student.studentId}`);
                    }}
                  >
                    <p className="font-medium">{student.firstName} {student.lastName}</p>
                    <p className="text-sm text-gray-500">ID: {student.studentId} | Class: {student.classAssigned}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (GHS) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Payment Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={formData.paymentMethod} onValueChange={(value) => handleInputChange('paymentMethod', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term</Label>
              <Select value={formData.term} onValueChange={(value) => handleInputChange('term', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Term 1 2024">Term 1 2024</SelectItem>
                  <SelectItem value="Term 2 2024">Term 2 2024</SelectItem>
                  <SelectItem value="Term 3 2024">Term 3 2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about the payment..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full md:w-auto" disabled={!formData.studentId}>
            Record Payment
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RecordPayment;
