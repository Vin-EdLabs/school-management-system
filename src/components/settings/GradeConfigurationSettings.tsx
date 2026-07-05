import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection, SETTINGS_CARD_CLASS } from './SettingsSection';
import { GraduationCap, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ComponentRow = { id?: number; name: string; weightInClassScore: number; displayOrder: number };
type BoundaryRow = {
  gradeLabel: string;
  minPercent: number;
  maxPercent: number;
  remark: string;
  displayOrder: number;
};

type GradeConfigResponse = {
  gradeConfig: { classScoreWeight: number; examWeight: number };
  components: Array<{ id: number; name: string; weightInClassScore: number; displayOrder: number }>;
  boundaries: Array<{
    id: number;
    gradeLabel: string;
    minPercent: number;
    maxPercent: number;
    remark: string | null;
    displayOrder: number;
  }>;
};

const BECE_DEFAULTS: BoundaryRow[] = [
  { gradeLabel: 'A1', minPercent: 80, maxPercent: 100, remark: 'Excellent', displayOrder: 1 },
  { gradeLabel: 'B2', minPercent: 70, maxPercent: 79, remark: 'Very Good', displayOrder: 2 },
  { gradeLabel: 'B3', minPercent: 60, maxPercent: 69, remark: 'Good', displayOrder: 3 },
  { gradeLabel: 'C4', minPercent: 55, maxPercent: 59, remark: 'Credit', displayOrder: 4 },
  { gradeLabel: 'C5', minPercent: 50, maxPercent: 54, remark: 'Credit', displayOrder: 5 },
  { gradeLabel: 'C6', minPercent: 45, maxPercent: 49, remark: 'Credit', displayOrder: 6 },
  { gradeLabel: 'D7', minPercent: 40, maxPercent: 44, remark: 'Pass', displayOrder: 7 },
  { gradeLabel: 'E8', minPercent: 35, maxPercent: 39, remark: 'Pass', displayOrder: 8 },
  { gradeLabel: 'F9', minPercent: 0, maxPercent: 34, remark: 'Fail', displayOrder: 9 },
];

const GradeConfigurationSettings: React.FC = () => {
  const [classScoreWeight, setClassScoreWeight] = useState('50');
  const [examWeight, setExamWeight] = useState('50');
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [boundaries, setBoundaries] = useState<BoundaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [referencedComponentIds, setReferencedComponentIds] = useState<Set<number>>(new Set());

  const weightSum = useMemo(
    () => Math.round((parseFloat(classScoreWeight || '0') + parseFloat(examWeight || '0')) * 100) / 100,
    [classScoreWeight, examWeight]
  );
  const componentSum = useMemo(
    () => Math.round(components.reduce((s, c) => s + (parseFloat(String(c.weightInClassScore)) || 0), 0) * 100) / 100,
    [components]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get<GradeConfigResponse>('/grade-config');
      setClassScoreWeight(String(data.gradeConfig.classScoreWeight));
      setExamWeight(String(data.gradeConfig.examWeight));
      setComponents(
        data.components.length
          ? data.components.map((c) => ({
              id: c.id,
              name: c.name,
              weightInClassScore: c.weightInClassScore,
              displayOrder: c.displayOrder,
            }))
          : [
              { name: 'Individual Test', weightInClassScore: 15, displayOrder: 1 },
              { name: 'Group Test', weightInClassScore: 15, displayOrder: 2 },
              { name: 'Class Test', weightInClassScore: 15, displayOrder: 3 },
              { name: 'Project', weightInClassScore: 15, displayOrder: 4 },
            ]
      );
      setBoundaries(
        data.boundaries.length
          ? data.boundaries.map((b) => ({
              gradeLabel: b.gradeLabel,
              minPercent: b.minPercent,
              maxPercent: b.maxPercent,
              remark: b.remark || '',
              displayOrder: b.displayOrder,
            }))
          : BECE_DEFAULTS
      );
    } catch (e: unknown) {
      toast({
        title: 'Could not load grade configuration',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moveBoundary = (index: number, dir: -1 | 1) => {
    setBoundaries((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next.map((b, i) => ({ ...b, displayOrder: i }));
    });
  };

  const handleSave = async () => {
    if (weightSum !== 100) {
      toast({ title: 'Class score and exam weights must sum to 100%', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiService.put('/grade-config', {
        classScoreWeight: parseFloat(classScoreWeight),
        examWeight: parseFloat(examWeight),
        components: components.map((c, i) => ({
          id: c.id,
          name: c.name.trim(),
          weightInClassScore: parseFloat(String(c.weightInClassScore)),
          displayOrder: i,
        })),
        boundaries: boundaries.map((b, i) => ({
          gradeLabel: b.gradeLabel.trim(),
          minPercent: parseFloat(String(b.minPercent)),
          maxPercent: parseFloat(String(b.maxPercent)),
          remark: b.remark.trim(),
          displayOrder: i,
        })),
      });
      toast({ title: 'Grade configuration saved' });
      await load();
    } catch (e: unknown) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const tryRemoveComponent = (index: number) => {
    const row = components[index];
    if (row.id && referencedComponentIds.has(row.id)) {
      toast({
        title: 'Cannot delete component',
        description: 'Assessments already use this component. Remove or reassign them first.',
        variant: 'destructive',
      });
      return;
    }
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <SettingsSection icon={GraduationCap} title="Grade Configuration" description="Loading…" accent="purple">
        <Card className={SETTINGS_CARD_CLASS}>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading grade settings…</CardContent>
        </Card>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      icon={GraduationCap}
      title="Grade Configuration"
      description="Configure class score vs exam weights, assessment types, and BECE grade boundaries."
      accent="purple"
    >
      <Card className={SETTINGS_CARD_CLASS}>
        <CardHeader className="border-b border-border/50 bg-muted/20 px-5 py-4">
          <CardTitle className="text-base font-semibold">Score weights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Class score weight (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={classScoreWeight}
                onChange={(e) => setClassScoreWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Exam weight (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={examWeight}
                onChange={(e) => setExamWeight(e.target.value)}
              />
            </div>
          </div>
          <p className={cn('text-sm font-medium', weightSum === 100 ? 'text-emerald-600' : 'text-red-600')}>
            Total: {weightSum}% {weightSum === 100 ? '✓' : '(must equal 100%)'}
          </p>
        </CardContent>
      </Card>

      <Card className={cn(SETTINGS_CARD_CLASS, 'mt-4')}>
        <CardHeader className="border-b border-border/50 bg-muted/20 px-5 py-4">
          <CardTitle className="text-base font-semibold">Class score types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-5 py-5">
          {components.map((row, index) => (
            <div key={row.id ?? `new-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
              <Input
                value={row.name}
                placeholder="Type name"
                onChange={(e) =>
                  setComponents((prev) =>
                    prev.map((c, i) => (i === index ? { ...c, name: e.target.value } : c))
                  )
                }
              />
              <Input
                type="number"
                min={0}
                step={0.01}
                value={row.weightInClassScore}
                placeholder="Weight"
                onChange={(e) =>
                  setComponents((prev) =>
                    prev.map((c, i) =>
                      i === index ? { ...c, weightInClassScore: parseFloat(e.target.value) || 0 } : c
                    )
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={
                  row.id && referencedComponentIds.has(row.id)
                    ? 'Used by assessments — cannot delete'
                    : 'Delete component'
                }
                onClick={() => tryRemoveComponent(index)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setComponents((prev) => [
                ...prev,
                { name: '', weightInClassScore: 0, displayOrder: prev.length },
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add type
          </Button>
          <p className="text-sm text-muted-foreground">
            Total weight: {componentSum}
          </p>
        </CardContent>
      </Card>

      <Card className={cn(SETTINGS_CARD_CLASS, 'mt-4')}>
        <CardHeader className="border-b border-border/50 bg-muted/20 px-5 py-4">
          <CardTitle className="text-base font-semibold">Grade boundaries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-5 py-5">
          {boundaries.map((row, index) => (
            <div
              key={`${row.gradeLabel}-${index}`}
              className="grid grid-cols-2 gap-2 sm:grid-cols-[80px_80px_80px_1fr_auto]"
            >
              <Input
                value={row.gradeLabel}
                placeholder="Grade"
                onChange={(e) =>
                  setBoundaries((prev) =>
                    prev.map((b, i) => (i === index ? { ...b, gradeLabel: e.target.value } : b))
                  )
                }
              />
              <Input
                type="number"
                value={row.minPercent}
                placeholder="Min %"
                onChange={(e) =>
                  setBoundaries((prev) =>
                    prev.map((b, i) =>
                      i === index ? { ...b, minPercent: parseFloat(e.target.value) || 0 } : b
                    )
                  )
                }
              />
              <Input
                type="number"
                value={row.maxPercent}
                placeholder="Max %"
                onChange={(e) =>
                  setBoundaries((prev) =>
                    prev.map((b, i) =>
                      i === index ? { ...b, maxPercent: parseFloat(e.target.value) || 0 } : b
                    )
                  )
                }
              />
              <Input
                value={row.remark}
                placeholder="Remark"
                onChange={(e) =>
                  setBoundaries((prev) =>
                    prev.map((b, i) => (i === index ? { ...b, remark: e.target.value } : b))
                  )
                }
              />
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => moveBoundary(index, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => moveBoundary(index, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setBoundaries((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setBoundaries((prev) => [
                ...prev,
                { gradeLabel: '', minPercent: 0, maxPercent: 0, remark: '', displayOrder: prev.length },
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add boundary
          </Button>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving || weightSum !== 100}>
          {saving ? 'Saving…' : 'Save grade configuration'}
        </Button>
      </div>
    </SettingsSection>
  );
};

export default GradeConfigurationSettings;
