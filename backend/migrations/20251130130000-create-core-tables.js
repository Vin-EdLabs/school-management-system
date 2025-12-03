'use strict';

var dbm;
var type;
var seed;
import { readFile } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
// ESM doesn't provide __dirname by default; emulate it so migrations can locate SQL files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
var Promise;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
export function setup(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
  Promise = options.Promise;
}

export function up(db) {
  var filePath = join(__dirname, 'sqls', '20251130130000-create-core-tables-up.sql');
  return new Promise( function( resolve, reject ) {
    readFile(filePath, {encoding: 'utf-8'}, function(err,data){
      if (err) return reject(err);
      console.log('received data: ' + data);

      resolve(data);
    });
  })
  .then(function(data) {
    return db.runSql(data);
  });
}

export function down(db) {
  var filePath = join(__dirname, 'sqls', '20251130130000-create-core-tables-down.sql');
  return new Promise( function( resolve, reject ) {
    readFile(filePath, {encoding: 'utf-8'}, function(err,data){
      if (err) return reject(err);
      console.log('received data: ' + data);

      resolve(data);
    });
  })
  .then(function(data) {
    return db.runSql(data);
  });
}

export const _meta = {
  "version": 1
};
