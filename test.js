/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

var assert = require('assert');
var child_process = require('child_process');
var native = require('bindings')('windows_process_tree');
var getProcessTree = require('.');

function pollUntil(condition, cb, interval, timeout) {
  const retries = 0;
  if (condition()) {
    cb();
  } else {
    setTimeout(() => {
      pollUntil(condition, cb, interval, timeout - interval);
    }, interval);
  }
}

describe('getProcessList', () => {
  it('should return a list containing this process', () => {
    var list = native.getProcessList();
    assert.notEqual(list.find(p => p.pid === process.pid), undefined);
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

  it('should return a tree containing this process', () => {
    var tree = getProcessTree(process.pid);
    assert.equal(tree.name, 'node.exe');
    assert.equal(tree.pid, process.pid);
    assert.equal(tree.children.length, 0);
  });

  it('should return a tree containing this process\'s child processes', done => {
    cps.push(child_process.spawn('cmd.exe'));
    pollUntil(() => {
      return getProcessTree(process.pid).children.length === 1
    }, () => done(), 20, 500);
  });

  it('should return a tree containing this process\'s child processes', done => {
    cps.push(child_process.spawn('powershell.exe'));
    cps.push(child_process.spawn('cmd.exe', ['/C', 'powershell.exe']));
    pollUntil(() => {
      var tree = getProcessTree(process.pid);
      return tree.children.length === 2 &&
          tree.children[0].name === 'powershell.exe' &&
          tree.children[0].children.length === 0 &&
          tree.children[1].name === 'cmd.exe' &&
          tree.children[1].children &&
          tree.children[1].children.length === 1 &&
          tree.children[1].children[0].name === 'powershell.exe';
    }, () => done(), 20, 500);
  });
});
