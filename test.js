var assert = require('assert');
var child_process = require('child_process');
var native = require('bindings')('windows_process_tree');
var getProcessTree = require('.');

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
    setTimeout(() => {
      var tree = getProcessTree(process.pid);
      assert.equal(tree.children.length, 1);
      done();
    }, 20);
  });
  
  it('should return a tree containing this process\'s child processes', done => {
    cps.push(child_process.spawn('powershell.exe'));
    cps.push(child_process.spawn('cmd.exe', ['/C', 'powershell.exe']));
    setTimeout(() => {
      var tree = getProcessTree(process.pid);
      assert.equal(tree.children.length, 2);
      assert.equal(tree.children[0].name, 'powershell.exe');
      assert.equal(tree.children[0].children.length, 0);
      assert.equal(tree.children[1].name, 'cmd.exe');
      assert.equal(tree.children[1].children.length, 1);
      assert.equal(tree.children[1].children[0].name, 'powershell.exe');
      done();
    }, 40);
  });
});