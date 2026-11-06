import { ProvisioningWorker } from './provisioning-worker';

export * from './provisioning-worker';

async function main() {
  const worker = new ProvisioningWorker();

  const shutdown = () => {
    console.log('\n[Worker] Received termination signal. Stopping worker...');
    worker.stop();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await worker.start();
}

// Only auto-run if directly executed via CLI / tsx
if (require.main === module || process.argv[1]?.includes('worker')) {
  main().catch((err) => {
    console.error('[Worker] Fatal error:', err);
    process.exit(1);
  });
}
