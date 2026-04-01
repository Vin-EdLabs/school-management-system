import { query } from '../config/db.js';

async function runFix() {
    console.log('--- START PAYROLL SCHEMA FIX ---');
    try {
        // Create payroll_bonuses table
        await query(`
      CREATE TABLE IF NOT EXISTS payroll_bonuses (
        id SERIAL PRIMARY KEY,
        payroll_item_id INTEGER REFERENCES payroll_items(id) ON DELETE CASCADE,
        bonus_type VARCHAR(50) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
        console.log('✓ Created payroll_bonuses table');

        // Update payroll_items to include notes if missing
        // await query(`ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS notes TEXT`);
        // console.log('✓ Verified notes column on payroll_items');

        console.log('--- DONE PAYROLL SCHEMA FIX ---');
    } catch (err) {
        console.error('FAILED TO FIX PAYROLL SCHEMA:', err);
    }
}

runFix();
