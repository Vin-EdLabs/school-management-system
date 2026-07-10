import type pg from 'pg';
import { query, getClient } from '../db/connection.js';
import {
  resolveLedgerTermFromSettings,
  executeTermSwitchWithArrears,
  recalculateTermOutstandingBalances,
} from './ledgerFinanceService.js';
import { refreshArrearsForTenantWithClient } from './arrearsService.js';

export type ActivationStepKey =
  | 'activate_term'
  | 'carry_forward'
  | 'recalculate_balances'
  | 'update_fee_bills'
  | 'sync_arrears'
  | 'complete';

export type ActivationStepResult = {
  key: ActivationStepKey;
  label: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  details?: Record<string, unknown>;
};

export type TermActivationResult = {
  success: boolean;
  termId: number;
  termName: string;
  academicYear: string;
  schoolName: string;
  steps: ActivationStepResult[];
  error?: string;
};

function buildFullTermLabel(termName: string, year: string): string {
  const clean = String(termName || '').trim();
  const y = String(year || '').trim();
  if (!y) return clean;
  return clean.includes(y) ? clean : `${clean} ${y}`.trim();
}

async function resolveLedgerTermId(
  tenantId: number,
  termName: string,
  year: string
): Promise<number | null> {
  const resolved = await resolveLedgerTermFromSettings(tenantId, year, buildFullTermLabel(termName, year));
  return resolved?.termId ?? null;
}

/** Shared carry-forward + balance sync for the currently active term (manual Sync Arrears). */
export async function syncArrearsCarryForwardForTenant(tenantId: number) {
  const activeRes = await query(
    `SELECT * FROM academic_terms WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
    [tenantId]
  );
  if (activeRes.rows.length === 0) {
    throw new Error('No active academic term. Set a term as active before syncing arrears.');
  }

  const current = activeRes.rows[0];
  const termName = String(current.term_name || '').trim();
  const academicYear = String(current.year || '').trim();
  const fullTermLabel = buildFullTermLabel(termName, academicYear);

  const prevRes = await query(
    `SELECT * FROM academic_terms
     WHERE tenant_id = $1
       AND (year < $2 OR (year = $2 AND start_date < $3))
     ORDER BY year DESC, start_date DESC
     LIMIT 1`,
    [tenantId, academicYear, current.start_date]
  );
  const previousTerm = prevRes.rows[0] || null;

  const currentLedgerTermId = await resolveLedgerTermId(tenantId, termName, academicYear);
  if (!currentLedgerTermId) {
    throw new Error(`Ledger term for "${fullTermLabel}" could not be resolved.`);
  }

  let prevLedgerTermId: number | null = null;
  if (previousTerm) {
    prevLedgerTermId = await resolveLedgerTermId(
      tenantId,
      String(previousTerm.term_name),
      String(previousTerm.year)
    );
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let carryResult: Record<string, unknown> = { skipped: true };
    if (prevLedgerTermId && prevLedgerTermId !== currentLedgerTermId) {
      const switched = await executeTermSwitchWithArrears(
        client,
        tenantId,
        prevLedgerTermId,
        currentLedgerTermId
      );
      carryResult = {
        arrearsRowsInserted: switched.arrearsRowsInserted,
        termFeesInserted: switched.termFeesInserted,
        previousTermId: prevLedgerTermId,
      };
    }

    const recalc = await recalculateTermOutstandingBalances(client, tenantId, currentLedgerTermId);
    const syncResult = await refreshArrearsForTenantWithClient(
      client,
      tenantId,
      fullTermLabel,
      academicYear
    );

    await client.query('COMMIT');

    return {
      carryForward: carryResult,
      recalculated: recalc,
      feeBills: { insertedCount: 0, skipped: true },
      arrears: syncResult,
      currentTerm: fullTermLabel,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function activateAcademicTerm(
  tenantId: number,
  academicTermId: number
): Promise<TermActivationResult> {
  const steps: ActivationStepResult[] = [];
  const fail = (key: ActivationStepKey, label: string, err: unknown): TermActivationResult => {
    const message = err instanceof Error ? err.message : String(err);
    steps.push({ key, label, status: 'failed', message });
    return {
      success: false,
      termId: academicTermId,
      termName: '',
      academicYear: '',
      schoolName: '',
      steps,
      error: message,
    };
  };

  const termRes = await query(
    `SELECT at.*, ss.school_name
     FROM academic_terms at
     LEFT JOIN school_settings ss ON ss.tenant_id = at.tenant_id
     WHERE at.id = $1 AND at.tenant_id = $2`,
    [academicTermId, tenantId]
  );
  if (termRes.rows.length === 0) {
    return fail('activate_term', 'Activating term', new Error('Academic term not found'));
  }

  const target = termRes.rows[0];
  const termName = String(target.term_name || '').trim();
  const academicYear = String(target.year || '').trim();
  const schoolName = String(target.school_name || 'School');
  const fullTermLabel = buildFullTermLabel(termName, academicYear);

  if (target.is_active === true) {
    return fail(
      'activate_term',
      `Activating term — ${termName} ${academicYear}`,
      new Error('This term is already active. Term activation is irreversible.')
    );
  }

  const previousRes = await query(
    `SELECT * FROM academic_terms WHERE tenant_id = $1 AND is_active = true AND id != $2 LIMIT 1`,
    [tenantId, academicTermId]
  );
  const previousActive = previousRes.rows[0] || null;

  let prevLedgerTermId: number | null = null;
  if (previousActive) {
    prevLedgerTermId = await resolveLedgerTermId(
      tenantId,
      String(previousActive.term_name),
      String(previousActive.year)
    );
    if (!prevLedgerTermId) {
      return fail(
        'activate_term',
        `Activating term — ${termName} ${academicYear}`,
        new Error(
          `Ledger term for previous active term "${previousActive.term_name} ${previousActive.year}" could not be resolved.`
        )
      );
    }
  }

  let newLedgerTermId = await resolveLedgerTermId(tenantId, termName, academicYear);
  if (!newLedgerTermId) {
    return fail(
      'activate_term',
      `Activating term — ${termName} ${academicYear}`,
      new Error(`Ledger term for "${fullTermLabel}" could not be resolved.`)
    );
  }

  if (prevLedgerTermId && prevLedgerTermId === newLedgerTermId) {
    return fail(
      'activate_term',
      `Activating term — ${termName} ${academicYear}`,
      new Error('Previous and new ledger terms are the same. Cannot activate.')
    );
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Step 1 — activate term
    const step1Label = `Activating term — ${termName} ${academicYear}`;
    await client.query('UPDATE academic_terms SET is_active = false WHERE tenant_id = $1', [tenantId]);
    await client.query(
      `UPDATE academic_terms SET is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [academicTermId, tenantId]
    );
    await client.query(
      `UPDATE academic_terms
       SET ledger_term_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3`,
      [newLedgerTermId, academicTermId, tenantId]
    );
    await client.query('UPDATE terms SET is_current = false WHERE tenant_id = $1', [tenantId]);
    await client.query('UPDATE terms SET is_current = true WHERE id = $1 AND tenant_id = $2', [
      newLedgerTermId,
      tenantId,
    ]);
    await client.query(
      `UPDATE school_settings
       SET current_term = $1, current_year = $2, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $3`,
      [fullTermLabel, academicYear, tenantId]
    );
    steps.push({ key: 'activate_term', label: step1Label, status: 'success' });

    // Step 2 — carry forward from previous term
    const step2Label = 'Carrying forward unpaid balances from previous term';
    let carryDetails: Record<string, unknown> = {};
    if (prevLedgerTermId) {
      const carryResult = await executeTermSwitchWithArrears(
        client,
        tenantId,
        prevLedgerTermId,
        newLedgerTermId
      );
      carryDetails = {
        arrearsRowsInserted: carryResult.arrearsRowsInserted,
        termFeesInserted: carryResult.termFeesInserted,
        previousTermId: prevLedgerTermId,
      };
      steps.push({ key: 'carry_forward', label: step2Label, status: 'success', details: carryDetails });
    } else {
      steps.push({
        key: 'carry_forward',
        label: step2Label,
        status: 'skipped',
        message: 'No previous active term — first term activation.',
        details: { firstTerm: true },
      });
    }

    // Step 3 — recalculate balances
    const step3Label = 'Recalculating student balances';
    const recalc = await recalculateTermOutstandingBalances(client, tenantId, newLedgerTermId);
    steps.push({
      key: 'recalculate_balances',
      label: step3Label,
      status: 'success',
      details: { rowsUpdated: recalc.rowsUpdated },
    });

    // Step 4 — fee billing is always manual per term (Set Fees / Bill Student)
    const step4Label = 'Updating fee bill records';
    steps.push({
      key: 'update_fee_bills',
      label: step4Label,
      status: 'skipped',
      message:
        'Skipped — assign fee structures in Fees for this term before students are billed.',
      details: { feeBillsCreated: 0 },
    });

    // Step 5 — final arrears sync
    const step5Label = 'Syncing arrears across all classes';
    const syncResult = await refreshArrearsForTenantWithClient(
      client,
      tenantId,
      fullTermLabel,
      academicYear
    );
    steps.push({
      key: 'sync_arrears',
      label: step5Label,
      status: 'success',
      details: syncResult,
    });

    await client.query('COMMIT');

    steps.push({
      key: 'complete',
      label: `Done — ${termName} is now active`,
      status: 'success',
    });

    return {
      success: true,
      termId: academicTermId,
      termName,
      academicYear,
      schoolName,
      steps,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const failedKey: ActivationStepKey =
      steps.length === 0
        ? 'activate_term'
        : steps[steps.length - 1]?.status === 'success'
          ? (['carry_forward', 'recalculate_balances', 'update_fee_bills', 'sync_arrears'][
              steps.filter((s) => s.status === 'success').length
            ] as ActivationStepKey) || 'carry_forward'
          : 'activate_term';
    const labels: Record<ActivationStepKey, string> = {
      activate_term: `Activating term — ${termName} ${academicYear}`,
      carry_forward: 'Carrying forward unpaid balances from previous term',
      recalculate_balances: 'Recalculating student balances',
      update_fee_bills: 'Updating fee bill records',
      sync_arrears: 'Syncing arrears across all classes',
      complete: `Done — ${termName} is now active`,
    };
    return {
      success: false,
      termId: academicTermId,
      termName,
      academicYear,
      schoolName,
      steps: [
        ...steps,
        {
          key: failedKey,
          label: labels[failedKey],
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        },
      ],
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    client.release();
  }
}
