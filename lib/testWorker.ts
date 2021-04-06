import * as assert from 'assert';
import { isMainThread, parentPort } from 'worker_threads';
import { getProcessList, filterProcessList } from './index';

if (!isMainThread) {
  new Promise(resolve => {
    getProcessList(process.pid, (list) => {
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].name, 'node.exe');
      assert.strictEqual(list[0].pid, process.pid);
      assert.strictEqual(list[0].memory, undefined);
      assert.strictEqual(list[0].commandLine, undefined);
      const filtered = filterProcessList(process.pid, list, 1);
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].name, 'node.exe');
      assert.strictEqual(filtered[0].pid, process.pid);
      assert.strictEqual(filtered[0].memory, undefined);
      assert.strictEqual(filtered[0].commandLine, undefined);
      resolve(true);
    });
  }).then((res) => {
    assert.strictEqual(res, true);
    parentPort.postMessage('done');
  });
}
