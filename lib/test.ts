/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getProcessTree, getProcessList, getProcessCpuUsage, getCurrentProcessUserSid, setOwnerOnlyAcl, ProcessDataFlag, buildProcessTree, filterProcessList } from './index';
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

  describe('getCurrentProcessUserSid', () => {
    it('should return the current user SID via the native and public APIs', () => {
      const sid = getCurrentProcessUserSid();
      assert.match(sid, /^S-1-\d+(?:-\d+)+$/);
      assert.strictEqual(sid, native.getCurrentProcessUserSid());
    });

    it('should return the same SID on repeated calls', () => {
      const sid = getCurrentProcessUserSid();
      for (let i = 0; i < 1000; i++) {
        assert.strictEqual(getCurrentProcessUserSid(), sid);
      }
    });

    it('should return the process user SID from a worker thread', async () => {
      const sid = await new Promise<string>((resolve, reject) => {
        let workerSid: string;
        const worker = new Worker(`
          const { parentPort, workerData } = require('worker_threads');
          parentPort.postMessage(require(workerData).getCurrentProcessUserSid());
        `, { eval: true, workerData: require.resolve('./index') });
        worker.once('message', (message: string) => { workerSid = message; });
        worker.once('error', reject);
        worker.once('exit', code => {
          if (code !== 0) {
            reject(new Error(`Worker exited with code ${code}`));
          } else {
            resolve(workerSid);
          }
        });
      });
      assert.strictEqual(sid, getCurrentProcessUserSid());
    });
  });

  describe('setOwnerOnlyAcl', () => {
    let directory: string;

    beforeEach(() => {
      directory = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-process-tree-acl-'));
    });

    afterEach(() => {
      fs.rmSync(directory, { recursive: true, force: true });
    });

    function powershell(script: string): string {
      const powershellDirectory = path.join(process.env.SystemRoot!, 'System32', 'WindowsPowerShell', 'v1.0');
      const env: NodeJS.ProcessEnv = { ...process.env, ACL_TEST_PATH: directory };
      for (const key of Object.keys(env)) {
        if (key.toLowerCase() === 'psmodulepath') {
          delete env[key];
        }
      }
      env.PSModulePath = path.join(powershellDirectory, 'Modules');
      return child_process.execFileSync(
        path.join(powershellDirectory, 'powershell.exe'),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference = 'Stop'; ${script}`],
        { encoding: 'utf8', env }
      ).trim();
    }

    it('should reject invalid native arguments', () => {
      for (const value of [undefined, null, 1, {}, '', 'invalid\0path']) {
        assert.throws(() => native.setOwnerOnlyAcl(value), TypeError);
      }
    });

    it('should reject invalid paths through the public API', async () => {
      await assert.rejects(setOwnerOnlyAcl(''), TypeError);
      await assert.rejects(setOwnerOnlyAcl(path.join(directory, 'missing')), /SetNamedSecurityInfoW failed: 2/);
    });

    it('should replace grants, protect inheritance and preserve ownership for Unicode paths', async () => {
      const target = path.join(directory, 'owner-only \u4e16\u754c');
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'existing.txt'), '');
      const owner = powershell(`
        $parentAcl = Get-Acl -LiteralPath $env:ACL_TEST_PATH
        $parentAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new(
          [System.Security.Principal.SecurityIdentifier]::new('S-1-1-0'),
          'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
        Set-Acl -LiteralPath $env:ACL_TEST_PATH -AclObject $parentAcl
        $target = (Get-ChildItem -LiteralPath $env:ACL_TEST_PATH -Directory).FullName
        $acl = Get-Acl -LiteralPath $target
        $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new(
          [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-546'),
          'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
        Set-Acl -LiteralPath $target -AclObject $acl
        $existing = Join-Path $target 'existing.txt'
        $existingAcl = Get-Acl -LiteralPath $existing
        $existingAcl.SetAccessRuleProtection($false, $false)
        @($existingAcl.Access | Where-Object { -not $_.IsInherited }) | ForEach-Object {
          [void]$existingAcl.RemoveAccessRuleSpecific($_)
        }
        Set-Acl -LiteralPath $existing -AclObject $existingAcl
        $acl.Owner
      `);

      await setOwnerOnlyAcl(target);
      await setOwnerOnlyAcl(target);
      fs.writeFileSync(path.join(target, 'new.txt'), '');
      fs.mkdirSync(path.join(target, 'child'));
      fs.writeFileSync(path.join(target, 'child', 'nested.txt'), '');

      const actual = JSON.parse(powershell(`
        $target = (Get-ChildItem -LiteralPath $env:ACL_TEST_PATH -Directory).FullName
        $paths = @($target, (Join-Path $target 'existing.txt'), (Join-Path $target 'new.txt'),
          (Join-Path $target 'child'), (Join-Path $target 'child\\nested.txt'))
        @($paths | ForEach-Object {
          $acl = Get-Acl -LiteralPath $_
          @{
            owner = $acl.Owner
            protected = $acl.AreAccessRulesProtected
            access = @($acl.Access | ForEach-Object {
              @{
                sid = $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
                rights = [int]$_.FileSystemRights
                type = [int]$_.AccessControlType
                inheritance = [int]$_.InheritanceFlags
                propagation = [int]$_.PropagationFlags
                inherited = $_.IsInherited
              }
            } | Sort-Object { $_.sid })
          }
        }) | ConvertTo-Json -Depth 5 -Compress
      `));
      const sids = [...new Set([getCurrentProcessUserSid(), 'S-1-5-18', 'S-1-5-32-544'])].sort();
      const expected = (isDirectory: boolean, inherited: boolean) => ({
        owner,
        protected: !inherited,
        access: sids.map(sid => ({
          sid, rights: 2032127, type: 0, inheritance: isDirectory ? 3 : 0, propagation: 0, inherited
        }))
      });
      assert.deepStrictEqual(actual, [
        expected(true, false), expected(false, true), expected(false, true), expected(true, true), expected(false, true)
      ]);
    });

    it('should apply ACLs to files and support concurrent calls', async () => {
      const files = Array.from({ length: 5 }, (_, i) => path.join(directory, `${i}.txt`));
      files.forEach(file => fs.writeFileSync(file, 'test'));
      await Promise.all(files.map(file => setOwnerOnlyAcl(file)));
      assert.deepStrictEqual(files.map(file => fs.readFileSync(file, 'utf8')), files.map(() => 'test'));
    });
  });

  describe('getAllProcesses', () => {
    it('should return a list containing this process via native API', (done) => {
      native.getProcessList((list) => {
        assert.notStrictEqual(list?.find(p => p.pid === process.pid), undefined);
        done();
      }, 0);
    });

    it('should work via API', (done) => {
      const { getAllProcesses } = require('./index');
      getAllProcesses((list) => {
        assert.ok(Array.isArray(list));
        assert.notStrictEqual(list.find(p => p.pid === process.pid), undefined);
        done();
      });
    });

    it('should work promisified', async () => {
      const list = await promises.getAllProcesses();
      assert.ok(Array.isArray(list));
      assert.notStrictEqual(list.find(p => p.pid === process.pid), undefined);
    });

    it('should return memory information only when the flag is set', async () => {
      const list = await promises.getAllProcesses(ProcessDataFlag.Memory);
      assert.ok(list.some(p => typeof p.memory === 'number'));
    });

    it('should return command line information only when the flag is set', async () => {
      const list = await promises.getAllProcesses(ProcessDataFlag.CommandLine);
      assert.ok(list.every(p => typeof p.commandLine === 'string'));
    });
  });
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

    it('should preserve Unicode characters in command line', async () => {
      const marker = 'Türkçe-Привет-你好';
      const child = child_process.spawn(
        process.execPath,
        ['-e', 'setInterval(() => {}, 10000)', marker],
        { windowsHide: true }
      );
      cps.push(child);

      assert.ok(child.pid, 'Failed to start the test process');
      const childPid = child.pid;

      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 2000;

        const poll = () => {
          getProcessList(childPid, (list) => {
            if (list?.some(processInfo => processInfo.pid === childPid && processInfo.commandLine?.includes(marker))) {
              resolve();
              return;
            }

            if (Date.now() >= deadline) {
              reject(new Error(`Timed out waiting for Unicode command line marker: ${marker}`));
              return;
            }

            setTimeout(poll, 20);
          }, ProcessDataFlag.CommandLine);
        };

        poll();
      });
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
  describe('setOwnerOnlyAcl', () => {
    it('should reject platforms other than Windows', async () => {
      await assert.rejects(setOwnerOnlyAcl('directory'), /only implemented on Windows/);
    });
  });

  describe('getCurrentProcessUserSid', () => {
    it('should reject platforms other than Windows', () => {
      assert.throws(() => getCurrentProcessUserSid(), /only implemented on Windows/);
    });
  });

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
