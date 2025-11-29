
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Calendar, Plus, Edit2, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import useStudents from '@/hooks/useStudents';
import usePayments from '@/hooks/usePayments';
import useFeeStructures from '@/hooks/useFeeStructures';
import { processArrearsForTermChange } from '../../utils/feeCalculations';

interface AcademicTerm {
  id: string;
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const AcademicTermManager = () => {
  const { students: rawStudents } = useStudents();
  const { payments: rawPayments } = usePayments();
  const { feeStructures: rawFeeStructures } = useFeeStructures();

  const students = (rawStudents || []).map((s: any) => ({
    id: s.id ?? String(s.id),
    firstName: s.first_name || s.firstName || '',
    lastName: s.last_name || s.lastName || '',
    classAssigned: s.classAssigned || s.class_assigned || ''
  }));

  const payments = (rawPayments || []).map((p: any) => ({
    id: p.id ?? String(p.id),
    studentId: String(p.student_id || p.studentId || p.student),
    term: p.term || p.term_name || p.termName || '',
    amount: Number(p.amount || 0)
  }));

  const feeStructures = (rawFeeStructures || []).map((f: any) => ({
    id: f.id ?? String(f.id),
    classId: f.class_id || f.classId || null,
    term: f.term || f.term_name || f.termName || '',
    amount: Number(f.amount || f.fee || 0)
  }));
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [isAddingTerm, setIsAddingTerm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<string | null>(null);
  const [newTerm, setNewTerm] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    startDate: '',
    endDate: ''
  });

  // Helper function to dispatch settings change event
  const dispatchSettingsChange = () => {
    window.dispatchEvent(new CustomEvent('academicSettingsChanged'));
  };

  // Load terms from localStorage on component mount
  useEffect(() => {
    const savedTerms = localStorage.getItem('academicTerms');
    if (savedTerms) {
      try {
        const parsedTerms = JSON.parse(savedTerms);
        setTerms(parsedTerms);
      } catch (error) {
        console.error('Error loading academic terms:', error);
      }
    } else {
      // Create default terms if none exist
      const defaultTerms: AcademicTerm[] = [
        {
          id: '1',
          name: 'Term 1',
          year: '2024',
          startDate: '2024-01-15',
          endDate: '2024-04-12',
          isActive: true
        },
        {
          id: '2',
          name: 'Term 2',
          year: '2024',
          startDate: '2024-04-29',
          endDate: '2024-07-26',
          isActive: false
        },
        {
          id: '3',
          name: 'Term 3',
          year: '2024',
          startDate: '2024-09-09',
          endDate: '2024-12-13',
          isActive: false
        }
      ];
      setTerms(defaultTerms);
      localStorage.setItem('academicTerms', JSON.stringify(defaultTerms));
    }
  }, []);

  const saveTerms = (updatedTerms: AcademicTerm[]) => {
    setTerms(updatedTerms);
    localStorage.setItem('academicTerms', JSON.stringify(updatedTerms));
    dispatchSettingsChange(); // Notify header of changes
  };

  const handleAddTerm = () => {
    if (!newTerm.name || !newTerm.year || !newTerm.startDate || !newTerm.endDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const newTermData: AcademicTerm = {
      id: Date.now().toString(),
      name: newTerm.name,
      year: newTerm.year,
      startDate: newTerm.startDate,
      endDate: newTerm.endDate,
      isActive: false
    };

    const updatedTerms = [...terms, newTermData];
    saveTerms(updatedTerms);

    toast({
      title: "Term Added",
      description: `${newTerm.name} ${newTerm.year} has been added successfully`,
    });

    setNewTerm({ name: '', year: new Date().getFullYear().toString(), startDate: '', endDate: '' });
    setIsAddingTerm(false);
  };

  const handleSetActiveTerm = (termId: string) => {
    const currentActiveTerm = terms.find(t => t.isActive);
    const newActiveTerm = terms.find(t => t.id === termId);
    
    if (!newActiveTerm) return;

    // Process arrears for term change if there's a current active term
    if (currentActiveTerm && currentActiveTerm.id !== termId) {
      const previousTermName = `${currentActiveTerm.name} ${currentActiveTerm.year}`;
      const newTermName = `${newActiveTerm.name} ${newActiveTerm.year}`;
      
      processArrearsForTermChange(
        students,
        payments,
        feeStructures,
        previousTermName,
        newTermName
      );
    }

    const updatedTerms = terms.map(term => ({
      ...term,
      isActive: term.id === termId
    }));

    saveTerms(updatedTerms);

    toast({
      title: "Active Term Changed",
      description: `${newActiveTerm.name} ${newActiveTerm.year} is now the active term`,
    });
  };

  const handleDeleteTerm = (termId: string) => {
    const termToDelete = terms.find(t => t.id === termId);
    if (!termToDelete) return;

    if (termToDelete.isActive) {
      toast({
        title: "Cannot Delete Active Term",
        description: "Please set another term as active before deleting this term",
        variant: "destructive"
      });
      return;
    }

    const updatedTerms = terms.filter(t => t.id !== termId);
    saveTerms(updatedTerms);

    toast({
      title: "Term Deleted",
      description: `${termToDelete.name} ${termToDelete.year} has been deleted`,
    });
  };

  const handleUpdateTerm = (termId: string, updatedData: Partial<AcademicTerm>) => {
    const updatedTerms = terms.map(term => 
      term.id === termId ? { ...term, ...updatedData } : term
    );
    saveTerms(updatedTerms);
    setEditingTerm(null);

    toast({
      title: "Term Updated",
      description: "Academic term has been updated successfully",
    });
  };

  const activeTerm = terms.find(t => t.isActive);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <span>Academic Term Management</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Active Term Display */}
        {activeTerm && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-800">Current Active Term</h3>
                <p className="text-green-700">{activeTerm.name} {activeTerm.year}</p>
                <p className="text-sm text-green-600">
                  {new Date(activeTerm.startDate).toLocaleDateString()} - {new Date(activeTerm.endDate).toLocaleDateString()}
                </p>
              </div>
              <Badge className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </div>
          </div>
        )}

        {/* Add New Term Form */}
        {isAddingTerm && (
          <div className="p-4 border border-gray-200 rounded-lg space-y-4">
            <h3 className="font-semibold">Add New Academic Term</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="termName">Term Name</Label>
                <Input
                  id="termName"
                  value={newTerm.name}
                  onChange={(e) => setNewTerm({ ...newTerm, name: e.target.value })}
                  placeholder="e.g., Term 1, First Semester"
                />
              </div>
              <div>
                <Label htmlFor="termYear">Academic Year</Label>
                <Input
                  id="termYear"
                  value={newTerm.year}
                  onChange={(e) => setNewTerm({ ...newTerm, year: e.target.value })}
                  placeholder="e.g., 2024"
                />
              </div>
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newTerm.startDate}
                  onChange={(e) => setNewTerm({ ...newTerm, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newTerm.endDate}
                  onChange={(e) => setNewTerm({ ...newTerm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleAddTerm}>Add Term</Button>
              <Button variant="outline" onClick={() => setIsAddingTerm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Add Term Button */}
        {!isAddingTerm && (
          <Button onClick={() => setIsAddingTerm(true)} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add New Academic Term
          </Button>
        )}

        {/* Terms List */}
        <div className="space-y-3">
          <h3 className="font-semibold">All Academic Terms</h3>
          {terms.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No academic terms found</p>
          ) : (
            <div className="space-y-2">
              {terms.map((term) => (
                <div key={term.id} className={`p-3 border rounded-lg ${term.isActive ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                  {editingTerm === term.id ? (
                    <EditTermForm
                      term={term}
                      onSave={(updatedData) => handleUpdateTerm(term.id, updatedData)}
                      onCancel={() => setEditingTerm(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{term.name} {term.year}</h4>
                          {term.isActive && (
                            <Badge variant="default" className="bg-green-500">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(term.startDate).toLocaleDateString()} - {new Date(term.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {!term.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetActiveTerm(term.id)}
                          >
                            Set Active
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTerm(term.id)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        {!term.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTerm(term.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Component for editing a term
const EditTermForm: React.FC<{
  term: AcademicTerm;
  onSave: (data: Partial<AcademicTerm>) => void;
  onCancel: () => void;
}> = ({ term, onSave, onCancel }) => {
  const [editData, setEditData] = useState({
    name: term.name,
    year: term.year,
    startDate: term.startDate,
    endDate: term.endDate
  });

  const handleSave = () => {
    if (!editData.name || !editData.year || !editData.startDate || !editData.endDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    onSave(editData);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Term Name</Label>
          <Input
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          />
        </div>
        <div>
          <Label>Academic Year</Label>
          <Input
            value={editData.year}
            onChange={(e) => setEditData({ ...editData, year: e.target.value })}
          />
        </div>
        <div>
          <Label>Start Date</Label>
          <Input
            type="date"
            value={editData.startDate}
            onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
          />
        </div>
        <div>
          <Label>End Date</Label>
          <Input
            type="date"
            value={editData.endDate}
            onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
          />
        </div>
      </div>
      <div className="flex space-x-2">
        <Button size="sm" onClick={handleSave}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default AcademicTermManager;
