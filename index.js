var addon = require('bindings')('windows_process_tree');

console.log(addon.hello().filter(a => !!a)); // 'world'