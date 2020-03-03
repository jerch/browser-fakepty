const headers = require('../lib/executables/headers').default;
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
// fake process parameter
let STDOUT = '';
const p = {
  stdout: {
    write(s) {
      STDOUT += s;
    }
  },
  exit() {}
}

if (ARGS.length) {
  // simply route ARGS to headers call
  headers(ARGS, process);
} else {
  // extract and update headers under /include
  const folder = path.join(__dirname, '..', 'include');
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);
  headers(['--list'], p);
  for (const file of STDOUT.split('\n').filter(Boolean)) {
    STDOUT = '';
    headers([file], p);
    const filename = path.join(folder, file);
    fs.writeFile(filename, STDOUT, err => {
      console.log(err ? `error writing "${filename}": ${err}` : `"${filename}" written.`);
    });
  }
}
