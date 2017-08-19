# windows-process-tree

Quickly fetch a process tree information for a particular process ID on Windows using Node.js.

## Usage

```js
if (process.platform === 'win32') {
  var child_process = require('child_process');
  var windowsProcessTree = require('windows-process-tree');

  child_process.spawn('cmd.exe');
  windowsProcessTree(process.pid, (tree) => {
    console.log(tree);
  });
  // { pid: 11168,
  //   name: 'node.exe',
  //   children:
  //    [ { pid: 1472, name: 'cmd.exe', children:[] },

  windowsProcessTree(0, (tree) => {
    console.log(tree);
  });
  // undefined
}
```

## Why a native node module?

The current convention is to run wmic.exe to query a particular process ID and then parse the output like so:

```js
let cp = require('child_process');

function getChildProcessDetails(pid, cb) {
    let args = ['process', 'where', `parentProcessId=${pid}`, 'get', 'ExecutablePath,ProcessId'];
    cp.execFile('wmic.exe', args, (err, stdout, stderr) => {
        if (err) {
            throw new Error(err);
        }
        if (stderr.length > 0) {
            cb([]);
        }
        var childProcessLines = stdout.split('\n').slice(1).filter(str => !/^\s*$/.test(str));
        var childProcessDetails = childProcessLines.map(str => {
            var s = str.split('  ');
            return { executable: s[0], pid: Number(s[1]) };
        });
        cb(childProcessDetails);
    });
}
```

This has two problems:

1. It takes > 100ms\* to spin up a process and get the output returned.
2. It only goes one level deep. Meaning, if the process tree is deeply nested or processes in the tree have many children it will take a lot more time and need a bunch of processes launched.

Both of which are only exacerbated by the fact that this information is something that a consumer may want to poll for.

The native node module uses Windows APIs to get the process details and then they are organized into a tree, getting the entire tree's details in < 20ms\*.

\* On my machine :slightly_smiling_face:

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
