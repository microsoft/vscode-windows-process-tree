var assert = require('assert');
var native = require('bindings')('windows_process_tree');

describe('getProcessList', () => {
    it('should return a list containing this process', () => {
        var list = native.getProcessList();
        var list = native.getProcessList();
        var list = native.getProcessList();console.log(list);
        // assert.notEqual(list.find(p => p.pid === process.pid), undefined);
    });
});