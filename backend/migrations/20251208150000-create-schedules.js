export function up(db) {
  return db.runSql(`
    CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      day_of_week SMALLINT NOT NULL DEFAULT 1,
      start_time TIME,
      end_time TIME,
      room TEXT,
      subject TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);
}

export function down(db) {
  return db.runSql('DROP TABLE IF EXISTS schedules');
}
