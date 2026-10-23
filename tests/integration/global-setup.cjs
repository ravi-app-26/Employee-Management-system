const { execFileSync } = require('node:child_process');
const path = require('node:path');

require('./setup-env.cjs');

module.exports = async () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const migrationCli = path.join(projectRoot, 'node_modules', '.bin', 'node-pg-migrate');

  execFileSync(
    process.execPath,
    [
      migrationCli,
      'up',
      '--migrations-dir',
      path.join(projectRoot, 'migrations'),
      '--database-url-var',
      'DATABASE_URL',
      '--verbose=false',
    ],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );
};