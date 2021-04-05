import * as assert from 'assert';
import { isMainThread, parentPort } from 'worker_threads';
import { filterProcessList } from './index';

if (!isMainThread) {
  const list = filterProcessList(0, [
    { pid: 0, ppid: 0, name: '0' }
  ], 3);
  assert.strictEqual(list.length, 4);
  assert.strictEqual(list[0].pid, 0);
  assert.strictEqual(list[1].pid, 0);
  assert.strictEqual(list[2].pid, 0);
  assert.strictEqual(list[3].pid, 0);
  parentPort.postMessage('done');
}
