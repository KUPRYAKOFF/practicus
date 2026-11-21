import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureSheetRows} from '../server/repository.js';
test('sheets expand beyond their initial row limit for audit growth and restore',()=>{
  let rows=1000;const added=[];const sheet={getMaxRows:()=>rows,insertRowsAfter:(after,count)=>{assert.equal(after,rows);added.push(count);rows+=count;}};
  ensureSheetRows(sheet,1000);assert.deepEqual(added,[]);ensureSheetRows(sheet,1001);assert.equal(rows,1500);
  ensureSheetRows(sheet,7001);assert.equal(rows,7001);assert.deepEqual(added,[500,5501]);
});
