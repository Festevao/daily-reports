import 'dotenv/config'
import { startConsumer } from './consumer'

startConsumer()
  .then((cleanup) => {
    process.on('SIGINT', async () => {
      await cleanup()
      process.exit(0)
    })
    process.on('SIGTERM', async () => {
      await cleanup()
      process.exit(0)
    })
  })
  .catch((err) => {
    console.error('💥  Falha ao iniciar o consumer:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
