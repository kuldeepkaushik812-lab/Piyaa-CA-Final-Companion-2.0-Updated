const { createServer } = require('vite');
async function run() {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'spa'
  });
  console.log('started');
  await vite.close();
}
run();
