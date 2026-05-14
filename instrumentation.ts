declare global {
  // eslint-disable-next-line no-var
  var __consumerStarted: boolean | undefined
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (global.__consumerStarted) return

  global.__consumerStarted = true

  const { startConsumer } = await import('./src/consumer')

  startConsumer().catch((err) => {
    console.error(
      '💥  Consumer falhou ao iniciar:',
      err instanceof Error ? err.message : err
    )
  })
}
