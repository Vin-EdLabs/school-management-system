import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbm;
let type;
let seed;

export function setup(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
}

export function up(db) {
  const filePath = path.join(__dirname, 'sqls', '20251205121000-add-email-displayname-to-users-up.sql');
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, {encoding: 'utf-8'}, (err, data) => {
      if (err) return reject(err);
      console.log('received data: ' + data);
      resolve(data);
    });
  })
  .then((data) => {
    return db.runSql(data);
  });
}

export function down(db) {
  const filePath = path.join(__dirname, 'sqls', '20251205121000-add-email-displayname-to-users-down.sql');
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, {encoding: 'utf-8'}, (err, data) => {
      if (err) return reject(err);
      console.log('received data: ' + data);
      resolve(data);
    });
  })
  .then((data) => {
    return db.runSql(data);
  });
}

export const _meta = {
  "version": 1
};
