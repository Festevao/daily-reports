function print(msg: string) {
  process.stdout.write(msg + '\n')
}

export function printErr(msg: string) {
  process.stderr.write(msg + '\n')
}

export function logSection(label: string) {
  print(`\n${'─'.repeat(50)}`)
  print(`  ${label}`)
  print('─'.repeat(50))
}

export function step(msg: string) {
  const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  print(`  [${ts}] ${msg}`)
}
