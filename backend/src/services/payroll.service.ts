import * as payrollRepo from '../repositories/payroll.repository.js';
import * as staffRepo from '../repositories/staff.repository.js';
import * as teacherRepo from '../repositories/teachers.repository.js';

export async function createPayrollRun(monthYear: string) {
  // Validate format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(monthYear)) {
    throw new Error('Invalid month_year format. Use YYYY-MM');
  }

  const run = await payrollRepo.createPayrollRun(monthYear);
  return run;
}

export async function initializePayrollRun(payrollRunId: number) {
  // Get all active staff
  const staff = await staffRepo.listStaff();
  const teachers = await teacherRepo.listTeachers();
  const allEmployees = [...staff, ...teachers];

  // Create payroll items for each employee
  for (const employee of allEmployees) {
    if (!employee) continue;

    // Check both potential salary field names
    const salary = Number(employee.monthly_salary ?? employee.monthlySalary ?? 0);

    if (salary > 0) {
      await payrollRepo.createPayrollItem(payrollRunId, employee.id, salary, 0, 0);
    }
  }

  return { initialized: true, staffCount: staff.length };
}

export async function getPayrollRunWithItems(payrollRunId: number) {
  const run = await payrollRepo.getPayrollRun(payrollRunId);
  if (!run) throw new Error('Payroll run not found');

  const items = await payrollRepo.getPayrollItemsForRun(payrollRunId);

  return {
    ...run,
    items,
    totalStaff: items.length,
    totalAmount: items.reduce((sum: number, item: any) => sum + item.net_amount, 0)
  };
}

export async function listPayrollRuns() {
  return payrollRepo.listPayrollRuns();
}

export async function processPayrollPayment(payrollItemId: number, paymentDate: string, paymentMethod: string = 'bank_transfer', referenceNumber?: string) {
  const item = await payrollRepo.getPayrollItemById(payrollItemId);
  if (!item) throw new Error('Payroll item not found');
  if (item.status === 'paid') throw new Error('Payroll item already paid');

  const result = await payrollRepo.recordPayrollPayment(
    payrollItemId,
    item.staff_id,
    item.net_amount,
    paymentDate,
    paymentMethod,
    referenceNumber
  );

  return result;
}

export async function getStaffPaymentHistory(staffId: number) {
  return payrollRepo.getPaymentHistory(staffId);
}

export async function addDeductionToPayrollItem(payrollItemId: number, deductionType: string, amount: number, description?: string) {
  return payrollRepo.addPayrollDeduction(payrollItemId, deductionType, amount, description);
}

export async function addBonusToPayrollItem(payrollItemId: number, bonusType: string, amount: number, description?: string) {
  return payrollRepo.addPayrollBonus(payrollItemId, bonusType, amount, description);
}

export async function getPayrollDeductions(payrollItemId: number) {
  return payrollRepo.getPayrollDeductions(payrollItemId);
}

export async function generatePayrollReport(payrollRunId: number, userId: number) {
  return payrollRepo.generatePayrollReport(payrollRunId, userId);
}

export default {
  createPayrollRun,
  initializePayrollRun,
  getPayrollRunWithItems,
  listPayrollRuns,
  processPayrollPayment,
  getStaffPaymentHistory,
  addDeductionToPayrollItem,
  addBonusToPayrollItem,
  getPayrollDeductions,
  generatePayrollReport
};
