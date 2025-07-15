
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Calendar, Plus, Check, Trash2 } from 'lucide-react';

interface AcademicTerm {
  id: string;
  name: string;
  year: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

const AcademicTermManager = () => {
  const { students, payments, feeStructures } = useData();
  const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>([]);
  const [currentTerm, setCurrentTerm] = useState<AcademicTerm | null>(null);
  const [newTermName, setNewTermName] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Load academic terms from localStorage
  useEffect(() => {
    const savedTerms = localStorage.getItem('academicTerms');
    if (savedTerms) {
      try {
        const terms = JSON.parse(savedTerms);
        setAcademicTerms(terms);
        const activeTerm = terms.find((term: AcademicTerm) => term.isActive);
        if (activeTerm) {
          setCurrentTerm(activeTerm);
        }
      } catch (error) {
        console.error('Error loading academic terms:', error);
      }
    } else {
      // Create default terms
      const defaultTerms: AcademicTerm[] = [
        {
          id: 'term1-2024',
          name: 'Term 1',
          year: '2024',
          isActive: true,
          startDate: '2024-01-08',
          endDate: '2024-04-12'
        },
        {
          id: 'term2-2024',
          name: 'Term 2',
          year: '2024',
          isActive: false,
          startDate: '2024-04-29',
          endDate: '2024-08-02'
        },
        {
          id: 'term3-2024',
          name: 'Term 3',
          year: '2024',
          isActive: false,
          startDate: '2024-08-19',
          endDate: '2024-12-13'
        }
      ];
      setAcademicTerms(defaultTerms);
      setCurrentTerm(defaultTerms[0]);
      localStorage.setItem('academicTerms', JSON.stringify(defaultTerms));
    }
  }, []);

  // Calculate arrears for term change
  const calculateArrearsForStudent = (studentId: string, previousTermId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return 0;

    const previousTerm = academicTerms.find(term => term.id === previousTermId);
    if (!previousTerm) return 0;

    const previousTermKey = `${previousTerm.name} ${previousTerm.year}`;
    
    // Get fee structure for student's class in previous term
    const previousFeeStructure = feeStructures.find(fee => 
      fee.className === student.classAssigned && fee.term === previousTermKey
    );
    
    if (!previousFeeStructure) return 0;

    // Calculate payments made in previous term
    const previousTermPayments = payments
      .filter(payment => payment.studentId === studentId && payment.term === previousTermKey)
      .reduce((sum, payment) => sum + payment.amount, 0);

    // Return arrears (positive) or credit (negative)
    return Math.max(0, previousFeeStructure.amount - previousTermPayments);
  };

  const addNewTerm = () => {
    if (!newTermName || !newYear || !newStartDate || !newEndDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const newTerm: AcademicTerm = {
      id: `${newTermName.toLowerCase().replace(/\s+/g, '-')}-${newYear}`,
      name: newTermName,
      year: newYear,
      isActive: false,
      startDate: newStartDate,
      endDate: newEndDate
    };

    const updatedTerms = [...academicTerms, newTerm];
    setAcademicTerms(updatedTerms);
    localStorage.setItem('academicTerms', JSON.stringify(updatedTerms));

    // Reset form
    setNewTermName('');
    setNewYear('');
    setNewStartDate('');
    setNewEndDate('');
    setShowAddForm(false);

    toast({
      title: "Term Added",
      description: `${newTermName} ${newYear} has been created successfully`,
    });
  };

  const setActiveTerm = (termId: string) => {
    const previousTerm = currentTerm;
    
    // Update terms - deactivate all, activate selected
    const updatedTerms = academicTerms.map(term => ({
      ...term,
      isActive: term.id === termId
    }));

    const newActiveTerm = updatedTerms.find(term => term.id === termId);
    if (!newActiveTerm) return;

    // Process arrears for all students if switching terms
    if (previousTerm && previousTerm.id !== termId) {
      const arrearsData: Record<string, number> = {};
      
      students.forEach(student => {
        const arrears = calculateArrearsForStudent(student.id, previousTerm.id);
        if (arrears > 0) {
          arrearsData[student.id] = arrears;
        }
      });

      // Store arrears data for the new term
      localStorage.setItem(`arrears-${termId}`, JSON.stringify(arrearsData));
    }

    setAcademicTerms(updatedTerms);
    setCurrentTerm(newActiveTerm);
    localStorage.setItem('academicTerms', JSON.stringify(updatedTerms));

    // Update legacy academic settings for backward compatibility
    localStorage.setItem('academicSettings', JSON.stringify({
      currentYear: newActiveTerm.year,
      currentTerm: `${newActiveTerm.name} ${newActiveTerm.year}`
    }));

    // Dispatch event to update other components
    window.dispatchEvent(new CustomEvent('academicTermChanged', { 
      detail: { 
        term: newActiveTerm,
        previousTerm: previousTerm
      } 
    }));

    toast({
      title: "Active Term Updated",
      description: `${newActiveTerm.name} ${newActiveTerm.year} is now the active term`,
    });
  };

  const deleteTerm = (termId: string) => {
    const termToDelete = academicTerms.find(term => term.id === termId);
    if (!termToDelete) return;

    if (termToDelete.isActive) {
      toast({
        title: "Cannot Delete Active Term",
        description: "Please set another term as active before deleting this one",
        variant: "destructive"
      });
      return;
    }

    const updatedTerms = academicTerms.filter(term => term.id !== termId);
    setAcademicTerms(updatedTerms);
    localStorage.setItem('academicTerms', JSON.stringify(updatedTerms));

    // Remove arrears data for deleted term
    localStorage.removeItem(`arrears-${termId}`);

    toast({
      title: "Term Deleted",
      description: `${termToDelete.name} ${termToDelete.year} has been deleted`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Academic Term & Year Management</span>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Term</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Active Term */}
        {currentTerm && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-800">Current Active Term</h3>
                <p className="text-green-700">{currentTerm.name} {currentTerm.year}</p>
                <p className="text-sm text-green-600">
                  {new Date(currentTerm.startDate).toLocaleDateString()} - {new Date(currentTerm.endDate).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="default" className="bg-green-500">Active</Badge>
            </div>
          </div>
        )}

        {/* Add New Term Form */}
        {showAddForm && (
          <div className="p-4 border rounded-lg bg-gray-50">
            <h3 className="font-semibold mb-4">Add New Academic Term</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="termName">Term Name</Label>
                <Input
                  id="termName"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder="e.g., Term 1, First Semester"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Academic Year</Label>
                <Input
                  id="year"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="e.g., 2024, 2024-2025"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button onClick={addNewTerm}>
                Add Term
              </Button>
            </div>
          </div>
        )}

        {/* Terms List */}
        <div className="space-y-3">
          <h3 className="font-semibold">All Academic Terms</h3>
          {academicTerms.map((term) => (
            <div key={term.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{term.name} {term.year}</span>
                  {term.isActive && <Badge variant="default" className="bg-green-500">Active</Badge>}
                </div>
                <p className="text-sm text-gray-600">
                  {new Date(term.startDate).toLocaleDateString()} - {new Date(term.endDate).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {!term.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTerm(term.id)}
                    className="flex items-center space-x-1"
                  >
                    <Check className="w-4 h-4" />
                    <span>Set Active</span>
                  </Button>
                )}
                {!term.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteTerm(term.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AcademicTermManager;
