import type { PoolClient } from 'pg';
import { query, getClient } from '../db/connection.js';
import type { GradeConfig } from '../utils/gradeCalculator.js';

export type GradeConfigPayload = {
  classScoreWeight: number;
  examWeight: number;
  components: Array<{ id?: number; name: string; weightInClassScore: number; displayOrder?: number }>;
  boundaries: Array<{
    gradeLabel: string;
    minPercent: number;
    maxPercent: number;
    remark?: string;
    displayOrder?: number;
  }>;
};

export type LoadedGradeConfig = {
  gradeConfig: {
    id: number;
    classScoreWeight: number;
    examWeight: number;
  };
  components: Array<{
    id: number;
    name: string;
    weightInClassScore: number;
    displayOrder: number;
  }>;
  boundaries: Array<{
    id: number;
    gradeLabel: string;
    minPercent: number;
    maxPercent: number;
    remark: string | null;
    displayOrder: number;
  }>;
};

function rowToCalculatorConfig(loaded: LoadedGradeConfig): GradeConfig {
  return {
    classScoreWeight: Number(loaded.gradeConfig.classScoreWeight),
    examWeight: Number(loaded.gradeConfig.examWeight),
    components: loaded.components.map((c) => ({
      id: c.id,
      name: c.name,
      weightInClassScore: Number(c.weightInClassScore),
    })),
    boundaries: loaded.boundaries.map((b) => ({
      gradeLabel: b.gradeLabel,
      minPercent: Number(b.minPercent),
      maxPercent: Number(b.maxPercent),
      remark: b.remark || '',
    })),
  };
}

export async function loadGradeConfigForTenant(tenantId: number): Promise<LoadedGradeConfig> {
  let configRes = await query(
    `SELECT id, class_score_weight, exam_weight FROM grade_configs WHERE tenant_id = $1`,
    [tenantId]
  );

  if (configRes.rows.length === 0) {
    await query(
      `INSERT INTO grade_configs (tenant_id, class_score_weight, exam_weight) VALUES ($1, 50, 50)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    );
    await seedDefaultComponentsAndBoundaries(tenantId);
    configRes = await query(
      `SELECT id, class_score_weight, exam_weight FROM grade_configs WHERE tenant_id = $1`,
      [tenantId]
    );
  }

  const row = configRes.rows[0];
  const configId = Number(row.id);

  const componentsRes = await query(
    `SELECT id, name, weight_in_class_score, display_order
     FROM grade_config_components
     WHERE tenant_id = $1 AND grade_config_id = $2
     ORDER BY display_order, id`,
    [tenantId, configId]
  );

  const boundariesRes = await query(
    `SELECT id, grade_label, min_percent, max_percent, remark, display_order
     FROM grade_boundaries
     WHERE tenant_id = $1
     ORDER BY display_order, min_percent DESC`,
    [tenantId]
  );

  return {
    gradeConfig: {
      id: configId,
      classScoreWeight: Number(row.class_score_weight),
      examWeight: Number(row.exam_weight),
    },
    components: componentsRes.rows.map((c) => ({
      id: Number(c.id),
      name: String(c.name),
      weightInClassScore: Number(c.weight_in_class_score),
      displayOrder: Number(c.display_order) || 0,
    })),
    boundaries: boundariesRes.rows.map((b) => ({
      id: Number(b.id),
      gradeLabel: String(b.grade_label),
      minPercent: Number(b.min_percent),
      maxPercent: Number(b.max_percent),
      remark: b.remark != null ? String(b.remark) : null,
      displayOrder: Number(b.display_order) || 0,
    })),
  };
}

export async function loadGradeConfigAsCalculator(tenantId: number): Promise<GradeConfig> {
  return rowToCalculatorConfig(await loadGradeConfigForTenant(tenantId));
}

export async function loadGradeConfigSnapshot(snapshot: unknown): Promise<GradeConfig | null> {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const s = snapshot as Record<string, unknown>;
  const components = Array.isArray(s.components) ? s.components : [];
  const boundaries = Array.isArray(s.boundaries) ? s.boundaries : [];
  if (s.classScoreWeight == null) return null;
  return {
    classScoreWeight: Number(s.classScoreWeight),
    examWeight: Number(s.examWeight ?? 100 - Number(s.classScoreWeight)),
    components: components.map((c: any) => ({
      id: Number(c.id),
      name: String(c.name),
      weightInClassScore: Number(c.weightInClassScore ?? c.weight_in_class_score),
    })),
    boundaries: boundaries.map((b: any) => ({
      gradeLabel: String(b.gradeLabel ?? b.grade_label),
      minPercent: Number(b.minPercent ?? b.min_percent),
      maxPercent: Number(b.maxPercent ?? b.max_percent),
      remark: String(b.remark ?? ''),
    })),
  };
}

export function serializeGradeConfigSnapshot(loaded: LoadedGradeConfig): Record<string, unknown> {
  return {
    classScoreWeight: loaded.gradeConfig.classScoreWeight,
    examWeight: loaded.gradeConfig.examWeight,
    components: loaded.components,
    boundaries: loaded.boundaries,
  };
}

async function seedDefaultComponentsAndBoundaries(tenantId: number): Promise<void> {
  const configRes = await query(`SELECT id FROM grade_configs WHERE tenant_id = $1`, [tenantId]);
  const configId = configRes.rows[0]?.id;
  if (!configId) return;

  const compCount = await query(
    `SELECT 1 FROM grade_config_components WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  if (compCount.rows.length === 0) {
    const defaults = [
      ['Individual Test', 25, 1],
      ['Group Test', 25, 2],
      ['Class Test', 25, 3],
      ['Project', 25, 4],
    ] as const;
    for (const [name, weight, ord] of defaults) {
      await query(
        `INSERT INTO grade_config_components (grade_config_id, tenant_id, name, weight_in_class_score, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [configId, tenantId, name, weight, ord]
      );
    }
  }

  const boundCount = await query(`SELECT 1 FROM grade_boundaries WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
  if (boundCount.rows.length === 0) {
    const bounds = [
      ['A1', 80, 100, 'Excellent', 1],
      ['B2', 70, 79, 'Very Good', 2],
      ['B3', 60, 69, 'Good', 3],
      ['C4', 55, 59, 'Credit', 4],
      ['C5', 50, 54, 'Credit', 5],
      ['C6', 45, 49, 'Credit', 6],
      ['D7', 40, 44, 'Pass', 7],
      ['E8', 35, 39, 'Pass', 8],
      ['F9', 0, 34, 'Fail', 9],
    ] as const;
    for (const [label, minP, maxP, remark, ord] of bounds) {
      await query(
        `INSERT INTO grade_boundaries (tenant_id, grade_label, min_percent, max_percent, remark, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, label, minP, maxP, remark, ord]
      );
    }
  }
}

export async function saveGradeConfigForTenant(
  tenantId: number,
  payload: GradeConfigPayload
): Promise<LoadedGradeConfig> {
  const classW = Number(payload.classScoreWeight);
  const examW = Number(payload.examWeight);
  if (Math.round((classW + examW) * 100) / 100 !== 100) {
    throw Object.assign(new Error('Class score weight and exam weight must sum to 100'), { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const configRes = await client.query(
      `INSERT INTO grade_configs (tenant_id, class_score_weight, exam_weight, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id) DO UPDATE
         SET class_score_weight = EXCLUDED.class_score_weight,
             exam_weight = EXCLUDED.exam_weight,
             updated_at = NOW()
       RETURNING id`,
      [tenantId, classW, examW]
    );
    const configId = Number(configRes.rows[0].id);

    const existingComps = await client.query(
      `SELECT id FROM grade_config_components WHERE tenant_id = $1`,
      [tenantId]
    );
    const existingIds = new Set(existingComps.rows.map((r) => Number(r.id)));
    const keptIds = new Set<number>();

    for (let i = 0; i < payload.components.length; i++) {
      const c = payload.components[i];
      const compId = c.id;
      if (compId && existingIds.has(compId)) {
        await client.query(
          `UPDATE grade_config_components
           SET name = $1, weight_in_class_score = $2, display_order = $3
           WHERE id = $4 AND tenant_id = $5`,
          [c.name.trim(), Number(c.weightInClassScore), c.displayOrder ?? i, compId, tenantId]
        );
        keptIds.add(compId);
      } else {
        const ins = await client.query(
          `INSERT INTO grade_config_components (grade_config_id, tenant_id, name, weight_in_class_score, display_order)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [configId, tenantId, c.name.trim(), Number(c.weightInClassScore), c.displayOrder ?? i]
        );
        keptIds.add(Number(ins.rows[0].id));
      }
    }

    for (const oldId of existingIds) {
      if (!keptIds.has(oldId)) {
        const ref = await client.query(
          `SELECT 1 FROM grade_assignments WHERE component_id = $1 LIMIT 1`,
          [oldId]
        );
        if (ref.rows.length > 0) {
          throw Object.assign(
            new Error('Cannot delete a component that is referenced by existing assessments'),
            { status: 400 }
          );
        }
        await client.query(`DELETE FROM grade_config_components WHERE id = $1 AND tenant_id = $2`, [
          oldId,
          tenantId,
        ]);
      }
    }

    await client.query(`DELETE FROM grade_boundaries WHERE tenant_id = $1`, [tenantId]);
    for (let i = 0; i < payload.boundaries.length; i++) {
      const b = payload.boundaries[i];
      await client.query(
        `INSERT INTO grade_boundaries (tenant_id, grade_label, min_percent, max_percent, remark, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          b.gradeLabel.trim(),
          Number(b.minPercent),
          Number(b.maxPercent),
          b.remark?.trim() || null,
          b.displayOrder ?? i,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return loadGradeConfigForTenant(tenantId);
}

export async function snapshotGradeConfigToAcademicTerm(
  client: PoolClient,
  tenantId: number,
  academicTermId: number
): Promise<void> {
  const loaded = await loadGradeConfigForTenant(tenantId);
  await client.query(
    `UPDATE academic_terms SET grade_config_snapshot = $1::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND tenant_id = $3`,
    [JSON.stringify(serializeGradeConfigSnapshot(loaded)), academicTermId, tenantId]
  );
}
