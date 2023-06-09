/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as child_process from 'child_process';
import * as path from 'path';
import { getProcessTree, getProcessList, getProcessCpuUsage, ProcessDataFlag, buildProcessTree, filterProcessList } from './index';
import { Worker, isMainThread } from 'worker_threads';
import { IProcessCpuInfo, IProcessInfo, IProcessTreeNode } from '@vscode/windows-process-tree';
import * as promises from './promises';
const isWindows = process.platform === 'win32';

function pollUntil(makePromise: () => Promise<boolean>, cb: () => void, interval: number, timeout: number): void {
  makePromise().then((success) => {
    if (success) {
      cb();
    } else {
      setTimeout(() => {
        pollUntil(makePromise, cb, interval, timeout - interval);
      }, interval);
    }
  });
}

if (isWindows) {
  const native = require('../build/Release/windows_process_tree.node');

  describe('getRawProcessList', () => {
    it('should throw if arguments are not provided', (done) => {
      assert.throws(() => native.getProcessList());
      done();
    });

    it('should throw if the first argument is not a function', (done) => {
      assert.throws(() => native.getProcessList(1));
      done();
    });

    it('should throw if the second argument is not a number', (done) => {
      assert.throws(() => native.getProcessList(() => {}, 'number'));
      done();
    });

    it('should return a list containing this process', (done) => {
      native.getProcessList((list) => {
        assert.notStrictEqual(list?.find(p => p.pid === process.pid), undefined);
        done();
      }, 0);
    });

    it('should handle multiple calls gracefully', (done) => {
      let counter = 0;
      const callback = (list) => {
        assert.notStrictEqual(list?.find(p => p.pid === process.pid), undefined);
        if (++counter === 2) {
          done();
        }
      };
      native.getProcessList(callback, ProcessDataFlag.None);
      native.getProcessList(callback, ProcessDataFlag.None);
    });

    it('should return memory information only when the flag is set', (done) => {
      // Memory should be undefined when flag is not set
      native.getProcessList((list) => {
        assert.strictEqual(list?.every(p => p.memory === undefined), true);

        // Memory should be a number when flag is set
        native.getProcessList((list) => {
          assert.strictEqual(list?.some(p => p.memory > 0), true);
          done();
        }, ProcessDataFlag.Memory);
      }, ProcessDataFlag.None);
    });

    it('should return command line information only when the flag is set', (done) => {
      // commandLine should be undefined when flag is not set
      native.getProcessList((list) => {
        assert.strictEqual(list?.every(p => p.commandLine === undefined), true);

        // commandLine should be a string when flag is set
        native.getProcessList((list) => {
          assert.strictEqual(list?.every(p => typeof p.commandLine === 'string'), true);
          done();
        }, ProcessDataFlag.CommandLine);
      }, ProcessDataFlag.None);
    });
  });

  describe('getProcessList', () => {
    let cps;

    beforeEach(() => {
      cps = [];
    });

    afterEach(() => {
      cps.forEach(cp => {
        cp.kill();
      });
    });

    it('should return a list containing this process', (done) => {
      getProcessList(process.pid, (list) => {
        assert.strictEqual(list?.length, 1);
        assert.strictEqual(list![0].name, 'node.exe');
        assert.strictEqual(list![0].pid, process.pid);
        assert.strictEqual(list![0].memory, undefined);
        assert.strictEqual(list![0].commandLine, undefined);
        done();
      });
    });

    it('should work promisified', async () => {
      const list: IProcessInfo[] = await promises.getProcessList(process.pid);

      assert.strictEqual(list.length, 1);
      const proc = list[0];
      assert.strictEqual(proc.name, 'node.exe');
      assert.strictEqual(proc.pid, process.pid);
    });

    it('should return a list containing this process\'s memory if the flag is set', done => {
      getProcessList(process.pid, (list) => {
        assert.strictEqual(list?.length, 1);
        assert.strictEqual(list![0].name, 'node.exe');
        assert.strictEqual(list![0].pid, process.pid);
        assert.strictEqual(typeof list![0].memory, 'number');
        done();
      }, ProcessDataFlag.Memory);
    });

    it('should return command line information only if the flag is set', (done) => {
      getProcessList(process.pid, (list) => {
        assert.strictEqual(list?.length, 1);
        assert.strictEqual(list![0].name, 'node.exe');
        assert.strictEqual(list![0].pid, process.pid);
        assert.strictEqual(typeof list![0].commandLine, 'string');
        // CommandLine is "<path to node> <path to mocha> lib/test.js"
        assert.strictEqual(list![0].commandLine!.indexOf('mocha') > 0, true);
        assert.strictEqual(list![0].commandLine!.indexOf('lib/test.js') > 0, true);
        done();
      }, ProcessDataFlag.CommandLine);
    });

    it('should return a list containing this process\'s child processes', done => {
      cps.push(child_process.spawn('cmd.exe'));
      pollUntil(() => {
        return new Promise((resolve) => {
          getProcessList(process.pid, (list) => {
            resolve(list?.length === 2 && list![0].pid === process.pid && list[1].pid === cps[0].pid);
          });
        });
      }, () => done(), 20, 500);
    });
  });

  describe('getProcessCpuUsage', () => {
    it('should throw on incorrect argument types', done => {
      assert.throws(() => getProcessCpuUsage('<…>' as any, () => null), /processList.*array/);
      assert.throws(() => getProcessCpuUsage([], '<…>' as any), /callback.*function/);
      done();
    });

    it('should get process cpu usage', (done) => {
        getProcessCpuUsage([{ pid: process.pid, ppid: process.ppid, name: 'node.exe' }], (annotatedList) => {
          assert.strictEqual(annotatedList.length, 1);
          assert.strictEqual(annotatedList![0].name, 'node.exe');
          assert.strictEqual(annotatedList![0].pid, process.pid);
          assert.strictEqual(annotatedList![0].memory, undefined);
          assert.strictEqual(typeof annotatedList![0].cpu, 'number');
          assert.strictEqual(0 <= annotatedList![0].cpu! && annotatedList![0].cpu! <= 100, true);
          done();
      });
    });

    it('should work promisified', async () => {
      const annotatedList: IProcessCpuInfo[] = await promises.getProcessCpuUsage([{ pid: process.pid, ppid: process.ppid, name: 'node.exe' }]);

      assert.strictEqual(annotatedList.length, 1);
      const proc = annotatedList[0];
      assert.strictEqual(proc.name, 'node.exe');
      assert.strictEqual(proc.pid, process.pid);
    });

    it('should handle multiple calls gracefully', function (done: Mocha.Done): void {
      this.timeout(3000);

      let counter = 0;
      const callback = (list) => {
        assert.notStrictEqual(list?.find(p => p.pid === process.pid), undefined);
        if (++counter === 2) {
          done();
        }
      };
      getProcessCpuUsage([{ pid: process.pid, ppid: process.ppid, name: 'node.exe' }], callback);
      getProcessCpuUsage([{ pid: process.pid, ppid: process.ppid, name: 'node.exe' }], callback);
    });
  });

  describe('getProcessTree', () => {
    let cps;

    beforeEach(() => {
      cps = [];
    });

    afterEach(() => {
      cps.forEach(cp => {
        cp.kill();
      });
    });

    it('should return a tree containing this process', done => {
      getProcessTree(process.pid, (tree) => {
        assert.strictEqual(tree!.name, 'node.exe');
        assert.strictEqual(tree!.pid, process.pid);
        assert.strictEqual(tree!.memory, undefined);
        assert.strictEqual(tree!.commandLine, undefined);
        assert.strictEqual(tree!.children.length, 0);
        done();
      });
    });

    it('should work promisified', async () => {
      const tree: IProcessTreeNode = await promises.getProcessTree(process.pid);

      assert.strictEqual(tree?.name, 'node.exe');
      assert.strictEqual(tree?.pid, process.pid);
    });

    it('should return a tree containing this process\'s memory if the flag is set', done => {
      getProcessTree(process.pid, (tree) => {
        assert.strictEqual(tree!.name, 'node.exe');
        assert.strictEqual(tree!.pid, process.pid);
        assert.notStrictEqual(tree!.memory, undefined);
        assert.strictEqual(tree!.children.length, 0);
        done();
      }, ProcessDataFlag.Memory);
    });

    it('should return a tree containing this process\'s command line if the flag is set', done => {
      getProcessTree(process.pid, (tree) => {
        assert.strictEqual(tree!.name, 'node.exe');
        assert.strictEqual(tree!.pid, process.pid);
        assert.strictEqual(typeof tree!.commandLine, 'string');
        assert.strictEqual(tree!.children.length, 0);
        done();
      }, ProcessDataFlag.CommandLine);
    });

    it('should return a tree containing this process\'s child processes (simple)', done => {
      cps.push(child_process.spawn('cmd.exe'));
      pollUntil(() => {
        return new Promise((resolve) => {
          getProcessTree(process.pid, (tree) => {
            resolve(tree!.children.length === 1);
          });
        });
      }, () => done(), 20, 500);
    });

    it('should return a tree containing this process\'s child processes (complex)', done => {
      cps.push(child_process.spawn('powershell.exe'));
      cps.push(child_process.spawn('cmd.exe', ['/C', 'powershell.exe']));
      pollUntil(() => {
        return new Promise((resolve) => {
          getProcessTree(process.pid, (tree) => {
            resolve(tree!.children.length === 2 &&
              tree!.children[0].name === 'powershell.exe' &&
              tree!.children[0].children.length === 0 &&
              tree!.children[1].name === 'cmd.exe' &&
              tree!.children[1].children &&
              tree!.children[1].children.length === 1 &&
              tree!.children[1].children[0].name === 'powershell.exe');
          });
        });
      }, () => done(), 20, 500);
    });
  });

  describe('buildProcessTree', () => {
    it('should enforce a maximum search depth', () => {
      const tree = buildProcessTree(0, [
        { pid: 0, ppid: 0, name: '0' }
      ], 3);
      assert.strictEqual(tree!.pid, 0);
      assert.strictEqual(tree!.children.length, 1);
      assert.strictEqual(tree!.children[0].pid, 0);
      assert.strictEqual(tree!.children[0].children.length, 1);
      assert.strictEqual(tree!.children[0].children[0].pid, 0);
      assert.strictEqual(tree!.children[0].children[0].children.length, 1);
      assert.strictEqual(tree!.children[0].children[0].children[0].pid, 0);
      assert.strictEqual(tree!.children[0].children[0].children[0].children.length, 0);
    });
  });

  describe('filterProcessList', () => {
    it('should enforce a maximum search depth', () => {
      const list = filterProcessList(0, [
        { pid: 0, ppid: 0, name: '0' }
      ], 3);
      assert.strictEqual(list?.length, 4);
      assert.strictEqual(list![0].pid, 0);
      assert.strictEqual(list![1].pid, 0);
      assert.strictEqual(list![2].pid, 0);
      assert.strictEqual(list![3].pid, 0);
    });
  });

  describe('contextAware', () => {
    it('should be context aware get process list', async () => {
      if (isMainThread) {
        const workerPromise: Promise<boolean> = new Promise(resolve => {
          const workerDir = path.join(__dirname, './testWorker.js');
          const worker = new Worker(workerDir);
          worker.on('message', (message: string) => {
            assert.strictEqual(message, 'done');
          });
          worker.on('error', () => {
            resolve(false);
          });
          worker.on('exit', (code) => {
            resolve(code === 0);
          });
        });
        const processListPromise: Promise<boolean> = new Promise(resolve => {
          getProcessList(process.pid, (list) => {
            assert.strictEqual(list!.length >= 1, true);
            assert.strictEqual(list![0].name, 'node.exe');
            assert.strictEqual(list![0].pid, process.pid);
            assert.strictEqual(list![0].memory, undefined);
            assert.strictEqual(list![0].commandLine, undefined);
            resolve(true);
          });
        });
        const combinedResult = await Promise.all([workerPromise, processListPromise]).then(results => {
          return results.every(result => result);
        }, () => {
          return false;
        });
        assert.strictEqual(combinedResult, true);
      }
    });

    it('should be context aware multiple workers', async () => {
      if (isMainThread) {
        const makeWorkerPromise = (): Promise<boolean> => {
          return new Promise(resolve => {
            const workerDir = path.join(__dirname, './testWorker.js');
            const worker = new Worker(workerDir);
            worker.on('message', (message: string) => {
              assert.strictEqual(message, 'done');
            });
            worker.on('error', () => {
              resolve(false);
            });
            worker.on('exit', (code) => {
              resolve(code === 0);
            });
          });
        };
        const workerPromises: Promise<boolean>[] = [];
        for (let i = 0; i < 50; i++) {
          workerPromises.push(makeWorkerPromise());
        }
        const processListPromise: Promise<boolean> = new Promise(resolve => {
          getProcessList(process.pid, (list) => {
            assert.strictEqual(list!.length >= 1, true);
            assert.strictEqual(list![0].name, 'node.exe');
            assert.strictEqual(list![0].pid, process.pid);
            assert.strictEqual(list![0].memory, undefined);
            assert.strictEqual(list![0].commandLine, undefined);
            resolve(true);
          });
        });
        const allPromises = [...workerPromises, processListPromise];
        const workerResult = await Promise.all(allPromises).then(results => {
          return results.every(result => result);
        }, () => {
          return false;
        });
        assert.strictEqual(workerResult, true);
      }
    });
  });
} else {
  describe('getProcessTree', () => {
    it('should not be implemented on Windows', () => {
      assert.throws(() => {
        getProcessTree(process.pid, (_) => {});
      });
      assert.throws(() => {
        getProcessTree(process.pid, (_) => {}, ProcessDataFlag.Memory);
      });
    });

    it('should not be implemented promisified on Windows', () => {
      assert.rejects(() => {
        return promises.getProcessTree(process.pid);
      });
      assert.rejects(() => {
        return promises.getProcessTree(process.pid, ProcessDataFlag.CommandLine);
      });
    });
  });

  describe('getProcessList', () => {
    it('should not be implemented on Windows', () => {
      assert.throws(() => {
        getProcessList(process.pid, (_) => {});
      });
      assert.throws(() => {
        getProcessList(process.pid, (_) => {}, ProcessDataFlag.CommandLine);
      });
    });

    it('should not be implemented promisified on Windows', () => {
      assert.rejects(() => {
        return promises.getProcessList(process.pid);
      });
      assert.rejects(() => {
        return promises.getProcessList(process.pid, ProcessDataFlag.Memory);
      });
    });
  });

  describe('getProcessCpuUsage', () => {
    it('should not be implemented on Windows', () => {
      assert.throws(() => {
        getProcessCpuUsage([], (_) => {});
      });
    });

    it('should not be implemented promisified on Windows', () => {
      assert.rejects(() => {
        return promises.getProcessCpuUsage([]);
      });
    });
  });

  describe('buildProcessTree', () => {
    it('should not be implemented on Windows', () => {
      assert.throws(() => {
        buildProcessTree(process.pid, [], 0);
      });
    });
  });

  describe('filterProcessList', () => {
    it('should not be implemented on Windows', () => {
      assert.throws(() => {
        filterProcessList(process.pid, [], 0);
      });
    });
  });
}
