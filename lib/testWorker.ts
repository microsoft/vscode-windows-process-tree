import * as assert from 'assert';
import { isMainThread, parentPort } from 'worker_threads';
import { getProcessList } from './index';

if (!isMainThread) {
  new Promise(resolve => {
    getProcessList(process.pid, (list) => {
      assert.notStrictEqual(list, undefined);
      assert.strictEqual(list!.length >= 1, true);
      assert.strictEqual(list![0].name, 'node.exe');
      assert.strictEqual(list![0].pid, process.pid);
      assert.strictEqual(list![0].memory, undefined);
      assert.strictEqual(list![0].commandLine, undefined);
      resolve(true);
    });
  }).then((res) => {
    assert.strictEqual(res, true);
    parentPort?.postMessage('done');
  }, () => {
    parentPort?.postMessage('fail');
  });
}
