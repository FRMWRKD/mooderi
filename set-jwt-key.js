const { spawn } = require('child_process');
const fs = require('fs');

const key = fs.readFileSync('private-key.pem', 'utf8');

function setKey(prod = false) {
  return new Promise((resolve, reject) => {
    const args = ['convex', 'env', 'set', 'JWT_PRIVATE_KEY', '--', key];
    if (prod) args.push('--prod');
    
    const proc = spawn('npx', args, { stdio: 'inherit', shell: true });
    
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });
  });
}

async function main() {
  console.log('Setting JWT_PRIVATE_KEY for dev...');
  await setKey(false);
  console.log('Setting JWT_PRIVATE_KEY for prod...');
  await setKey(true);
  console.log('Done!');
}

main().catch(console.error);
