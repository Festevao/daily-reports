import 'dotenv/config'
import { startConsumer } from './consumer'
import { logSection, printErr } from './logger'

const BASE_DELAY_MS = 2_000
const MAX_DELAY_MS = 30_000

async function run() {
  let attempt = 0
  let shuttingDown = false
  let activeCleanup: (() => Promise<void>) | null = null

  const shutdown = async () => {
    shuttingDown = true
    logSection('⏹ Sinal recebido — encerrando consumer')
    if (activeCleanup) await activeCleanup().catch(() => {})
    process.exit(0)
  }

  process.on('SIGTERM', () => { void shutdown() })
  process.on('SIGINT', () => { void shutdown() })

  process.on('uncaughtException', (err) => {
    printErr(`💥 uncaughtException: ${err.message}`)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    printErr(`💥 unhandledRejection: ${String(reason)}`)
    process.exit(1)
  })

  while (!shuttingDown) {
    try {
      const { cleanup, disconnected } = await startConsumer()
      activeCleanup = cleanup
      attempt = 0

      await disconnected

      activeCleanup = null
    } catch (err) {
      if (shuttingDown) break

      attempt++
      const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS)
      const message = err instanceof Error ? err.message : String(err)
      printErr(`💥 Consumer desconectou (tentativa ${attempt}): ${message}. Reconectando em ${delay / 1000}s...`)
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
  }
}

run().catch((err) => {
  printErr(`💥 Erro fatal: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
