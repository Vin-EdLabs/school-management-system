import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Calendar, Plus, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { useActiveTerm } from '../../contexts/ActiveTermContext';

interface AcademicTerm {
  id: string;
  term_name: string;
  year: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface LedgerTerm {
  id: number;
  name: string;
  is_current: boolean;
  academic_year_id: number;
  academic_year_name: string;
}

const AcademicTermManager = () => {
  const { refresh } = useActiveTerm();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [ledgerTerms, setLedgerTerms] = useState<LedgerTerm[]>([]);
  const [isAddingTerm, setIsAddingTerm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTerm, setNewTerm] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    startDate: '',
    endDate: ''
  });

  const loadTerms = async () => {
    setLoading(true);
    try {
      const [academicData, ledgerData] = await Promise.all([
        apiService.get<AcademicTerm[]>('/settings/academic-terms').catch(() => []),
        apiService.get<LedgerTerm[]>('/finance/terms').catch(() => [])
      ]);
      const list = Array.isArray(academicData) ? academicData : [];
      setTerms(list.map((t: any) => ({
        id: t.id.toString(),
        term_name: t.term_name,
        year: t.year,
        start_date: t.start_date || '',
        end_date: t.end_date || '',
        is_active: t.is_active
      })));
      const ledgerList = Array.isArray(ledgerData) ? ledgerData : [];
      setLedgerTerms(ledgerList.map((t: any) => ({
        id: parseInt(String(t.id), 10),
        name: t.name || '',
        is_current: t.is_current || false,
        academic_year_id: parseInt(String(t.academic_year_id), 10),
        academic_year_name: t.academic_year_name || ''
      })));
    } catch (error) {
      console.error('Error loading terms:', error);
      setTerms([]);
      setLedgerTerms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  const handleAddTerm = async () => {
    if (!newTerm.name || !newTerm.year || !newTerm.startDate || !newTerm.endDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiService.post('/settings/academic-terms', {
        term_name: newTerm.name,
        year: newTerm.year,
        start_date: newTerm.startDate,
        end_date: newTerm.endDate,
        is_active: false
      });

      toast({
        title: "Term Added",
        description: `${newTerm.name} ${newTerm.year} has been added successfully`,
      });

      setNewTerm({ name: '', year: new Date().getFullYear().toString(), startDate: '', endDate: '' });
      setIsAddingTerm(false);
      await loadTerms();
      await refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add term",
        variant: "destructive"
      });
    }
  };

  const handleSetActiveTerm = async (termId: string) => {
    const termToActivate = terms.find(t => t.id === termId);
    if (!termToActivate) return;

    try {
      const previousActive = terms.find(t => t.is_active);
      
      // Find ledger terms by matching name and year
      const cleanTermName = (name: string) => name.replace(/\s+\d{4}$/, '').trim();
      const findLedgerTerm = (academicTerm: AcademicTerm, list: LedgerTerm[]) => {
        const cleanName = cleanTermName(academicTerm.term_name);
        return list.find(lt => {
          const matchName = lt.name === academicTerm.term_name || 
                          lt.name === cleanName || 
                          `${lt.name} ${lt.academic_year_name}` === academicTerm.term_name;
          return matchName && lt.academic_year_name === academicTerm.year;
        });
      };
      
      let prevLedgerTerm = previousActive ? findLedgerTerm(previousActive, ledgerTerms) : null;
      let newLedgerTerm = findLedgerTerm(termToActivate, ledgerTerms);
      
      console.log('[TermSwitch] Initial lookup:', { 
        prev: previousActive?.term_name, 
        prevFound: !!prevLedgerTerm,
        new: termToActivate.term_name,
        newFound: !!newLedgerTerm 
      });

      // If new ledger term doesn't exist, try to create it
      if (!newLedgerTerm) {
        try {
          console.log('[TermSwitch] New ledger term not found, attempting to create...');
          const fullTermName = termToActivate.term_name.includes(termToActivate.year) 
            ? termToActivate.term_name 
            : `${termToActivate.term_name} ${termToActivate.year}`;

          await apiService.put('/settings', {
            current_term: fullTermName,
            current_year: termToActivate.year,
            skip_auto_post: true,
          });
          
          const updatedLedgerData = await apiService.get<LedgerTerm[]>('/finance/terms');
          const updatedLedgerList = Array.isArray(updatedLedgerData) ? updatedLedgerData : [];
          setLedgerTerms(updatedLedgerList.map((t: any) => ({
            id: parseInt(String(t.id), 10),
            name: t.name || '',
            is_current: t.is_current || false,
            academic_year_id: parseInt(String(t.academic_year_id), 10),
            academic_year_name: t.academic_year_name || ''
          })));
          
          newLedgerTerm = findLedgerTerm(termToActivate, updatedLedgerList.map((t: any) => ({
            id: parseInt(String(t.id), 10),
            name: t.name || '',
            is_current: t.is_current || false,
            academic_year_id: parseInt(String(t.academic_year_id), 10),
            academic_year_name: t.academic_year_name || ''
          })));
          console.log('[TermSwitch] After creation attempt:', { newFound: !!newLedgerTerm });
        } catch (err: any) {
          throw new Error(`CRITICAL: Failed to create ledger term for ${termToActivate.term_name}. ${err?.message}`);
        }
      }
      
      // If previous term exists but ledger term not found, try to create it
      if (previousActive && !prevLedgerTerm) {
        try {
          console.log('[TermSwitch] Prev ledger term not found, attempting to create...');
          const fullTermName = previousActive.term_name.includes(previousActive.year) 
            ? previousActive.term_name 
            : `${previousActive.term_name} ${previousActive.year}`;

          await apiService.put('/settings', {
            current_term: fullTermName,
            current_year: previousActive.year,
            skip_auto_post: true,
          });
          const updatedLedgerData = await apiService.get<LedgerTerm[]>('/finance/terms');
          const updatedLedgerList = Array.isArray(updatedLedgerData) ? updatedLedgerData : [];
          prevLedgerTerm = findLedgerTerm(previousActive, updatedLedgerList.map((t: any) => ({
            id: parseInt(String(t.id), 10),
            name: t.name || '',
            is_current: t.is_current || false,
            academic_year_id: parseInt(String(t.academic_year_id), 10),
            academic_year_name: t.academic_year_name || ''
          })));
          console.log('[TermSwitch] Prev creation attempt:', { prevFound: !!prevLedgerTerm });
        } catch (err: any) {
          console.warn('[TermSwitch] Could not create previous ledger term:', err);
        }
      }

      if (!newLedgerTerm) {
        throw new Error(
          `CRITICAL: Ledger term for "${termToActivate.term_name} ${termToActivate.year}" could not be resolved. ` +
          `Please ensure a corresponding term exists in the Finance section.`
        );
      }
      
      // If no previous term (first term ever), we can still switch - just won't carry arrears
      // But if there WAS a previous active term and we can't find its ledger term, that's an error
      if (!prevLedgerTerm && previousActive) {
        throw new Error(
          `CRITICAL: Cannot switch terms - ledger term for previous term not found. ` +
          `Previous: ${previousActive.term_name} ${previousActive.year}. ` +
          `This should not happen - ledger terms should be created when academic terms are created. ` +
          `Try refreshing the page or contact support.`
        );
      }
      
      // If no previous term at all (first term ever), we can't carry arrears but can still switch
      // In this case, prevLedgerTerm will be null, which is OK

      if (prevLedgerTerm && prevLedgerTerm.id === newLedgerTerm.id) {
        throw new Error(
          `CRITICAL: Cannot switch to the same term (ID: ${newLedgerTerm.id}). ` +
          `Previous and new terms must be different.`
        );
      }

      // FORCE term switch - this MUST succeed or throw error
      // If no previous term (first term), currentTermId will be undefined and backend will handle it
      await apiService.post('/finance/switch-term', {
        currentTermId: prevLedgerTerm?.id,
        newTermId: newLedgerTerm.id,
      });

      // Update academic_terms table (UI state)
      await apiService.put(`/settings/academic-terms/${termId}`, {
        is_active: true
      });

      // Update settings for display ONLY, and explicitly skip any automatic
      // fee/arrears posting here. All finance logic is handled by /finance/switch-term.
      const finalTermName = termToActivate.term_name.includes(termToActivate.year) 
        ? termToActivate.term_name 
        : `${termToActivate.term_name} ${termToActivate.year}`;

      await apiService.put('/settings', {
        current_term: finalTermName,
        current_year: termToActivate.year,
        skip_auto_post: true,
      });

      toast({
        title: "Active Term Changed",
        description: `${termToActivate.term_name} ${termToActivate.year} is now the active term${newLedgerTerm ? ` (Ledger ID: ${newLedgerTerm.id})` : ''}`,
      });

      await loadTerms();
      await refresh();
    } catch (error: any) {
      // DO NOT SWALLOW ERRORS - show them clearly
      const errorMsg = error?.response?.data?.error || error?.message || 'CRITICAL: Term switch failed';
      toast({
        title: "CRITICAL ERROR - Term Switch Failed",
        description: `${errorMsg}. The system could not carry arrears automatically. Please check backend logs.`,
        variant: "destructive"
      });
      // Re-throw so it shows in console too
      console.error('[AcademicTermManager] CRITICAL: Term switch failed:', error);
      throw error; // Let it crash - user needs to see this
    }
  };

  const handleDeleteTerm = async (termId: string) => {
    const termToDelete = terms.find(t => t.id === termId);
    if (!termToDelete) return;

    if (termToDelete.is_active) {
      toast({
        title: "Cannot Delete Active Term",
        description: "Please set another term as active before deleting this term",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiService.delete(`/settings/academic-terms/${termId}`);
      toast({
        title: "Term Deleted",
        description: `${termToDelete.term_name} ${termToDelete.year} has been deleted`,
      });
      await loadTerms();
      await refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete term",
        variant: "destructive"
      });
    }
  };

  const handleUpdateTerm = async (termId: string, updatedData: Partial<AcademicTerm>) => {
    try {
      await apiService.put(`/settings/academic-terms/${termId}`, {
        term_name: updatedData.term_name,
        year: updatedData.year,
        start_date: updatedData.start_date,
        end_date: updatedData.end_date
      });

      toast({
        title: "Term Updated",
        description: "Academic term has been updated successfully",
      });

      setEditingTerm(null);
      await loadTerms();
      await refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update term",
        variant: "destructive"
      });
    }
  };

  const activeTerm = terms.find(t => t.is_active);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <span>Academic Term Management</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {activeTerm && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-800">Current Active Term</h3>
                <p className="text-green-700">{activeTerm.term_name} {activeTerm.year}</p>
                {activeTerm.start_date && activeTerm.end_date && (
                  <p className="text-sm text-green-600">
                    {new Date(activeTerm.start_date).toLocaleDateString()} - {new Date(activeTerm.end_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Badge className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </div>
          </div>
        )}

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

        {!isAddingTerm && (
          <Button onClick={() => setIsAddingTerm(true)} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add New Academic Term
          </Button>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold">All Academic Terms</h3>
          {loading ? (
            <p className="text-gray-500 text-center py-4">Loading...</p>
          ) : terms.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No academic terms found. Add your first term above.</p>
          ) : (
            <div className="space-y-2">
              {terms.map((term) => (
                <div key={term.id} className={`p-3 border rounded-lg ${term.is_active ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                  {editingTerm === term.id ? (
                    <EditTermForm
                      term={term}
                      onSave={(data) => handleUpdateTerm(term.id, data)}
                      onCancel={() => setEditingTerm(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{term.term_name} {term.year}</h4>
                          {term.is_active && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded">Active</span>
                          )}
                        </div>
                        {(() => {
                          const ledgerTerm = ledgerTerms.find(lt =>
                            lt.name === term.term_name.replace(/\s+\d{4}$/, '').trim() &&
                            lt.academic_year_name === term.year
                          );
                          return ledgerTerm ? (
                            <p className="text-xs text-blue-600 font-mono mt-1">
                              Ledger Term ID: {ledgerTerm.id} (Year ID: {ledgerTerm.academic_year_id})
                            </p>
                          ) : null;
                        })()}
                        {term.start_date && term.end_date && (
                          <p className="text-sm text-gray-600">
                            {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {!term.is_active && (
                          <Button size="sm" variant="outline" onClick={() => handleSetActiveTerm(term.id)}>
                            Set Active
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setEditingTerm(term.id)}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        {!term.is_active && (
                          <Button size="sm" variant="outline" onClick={() => handleDeleteTerm(term.id)} className="text-red-600 hover:text-red-700">
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

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${className || ''}`}>{children}</span>
);

const EditTermForm: React.FC<{
  term: AcademicTerm;
  onSave: (data: Partial<AcademicTerm>) => void;
  onCancel: () => void;
}> = ({ term, onSave, onCancel }) => {
  const [editData, setEditData] = useState({
    term_name: term.term_name,
    year: term.year,
    start_date: term.start_date,
    end_date: term.end_date
  });

  const handleSave = () => {
    if (!editData.term_name || !editData.year || !editData.start_date || !editData.end_date) {
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
            value={editData.term_name}
            onChange={(e) => setEditData({ ...editData, term_name: e.target.value })}
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
            value={editData.start_date}
            onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
          />
        </div>
        <div>
          <Label>End Date</Label>
          <Input
            type="date"
            value={editData.end_date}
            onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
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
