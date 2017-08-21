/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

var assert = require('assert');
var child_process = require('child_process');
var getProcessTree = require('.');

var native = require('./build/Release/windows_process_tree.node');

function pollUntil(makePromise, cb, interval, timeout) {
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

describe('getProcessList', () => {
  it('should return a list containing this process', (done) => {
    native.getProcessList((list) => {
      assert.notEqual(list.find(p => p.pid === process.pid), undefined);
      done();
    });
  });

  it('should handle multiple calls gracefully', (done) => {
    let counter = 0;
    const callback = (list) => {
      assert.notEqual(list.find(p => p.pid === process.pid), undefined);
      if (++counter === 2) {
        done();
      }
    };
    native.getProcessList(callback);
    native.getProcessList(callback);
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
      assert.equal(tree.name, 'node.exe');
      assert.equal(tree.pid, process.pid);
      assert.equal(tree.children.length, 0);
      done();
    });
  });

  it('should return a tree containing this process\'s child processes', done => {
    cps.push(child_process.spawn('cmd.exe'));
    pollUntil(() => {
      return new Promise((resolve) => {
        getProcessTree(process.pid, (tree) => {
          resolve(tree.children.length === 1);
        });
      });
    }, () => done(), 20, 500);
  });

  it('should return a tree containing this process\'s child processes', done => {
    cps.push(child_process.spawn('powershell.exe'));
    cps.push(child_process.spawn('cmd.exe', ['/C', 'powershell.exe']));
    pollUntil(() => {
      return new Promise((resolve) => {
        getProcessTree(process.pid, (tree) => {
          resolve(tree.children.length === 2 &&
            tree.children[0].name === 'powershell.exe' &&
            tree.children[0].children.length === 0 &&
            tree.children[1].name === 'cmd.exe' &&
            tree.children[1].children &&
            tree.children[1].children.length === 1 &&
            tree.children[1].children[0].name === 'powershell.exe');
        });
      });
    }, () => done(), 20, 500);
  });
});
