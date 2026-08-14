import { createServer } from 'vite';
async function run() {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'spa'
  });
  console.log('started');
  await vite.close();
}
run();
