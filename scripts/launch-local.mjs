import { spawn } from 'node:child_process'
import { closeSync, openSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectPath = path.resolve(scriptDirectory, '..')
const nextCli = path.join(projectPath, 'node_modules', 'next', 'dist', 'bin', 'next')
const pidFile = path.join(projectPath, '.local-server.pid')
const stdoutLog = path.join(projectPath, '.local-server.out.log')
const stderrLog = path.join(projectPath, '.local-server.err.log')

const stdout = openSync(stdoutLog, 'a')
const stderr = openSync(stderrLog, 'a')

try {
  const child = spawn(process.execPath, [nextCli, 'dev', '-H', '127.0.0.1', '-p', '3000'], {
    cwd: projectPath,
    detached: true,
    env: process.env,
    stdio: ['ignore', stdout, stderr],
    windowsHide: true,
  })

  child.unref()
  writeFileSync(
    pidFile,
    JSON.stringify({ pid: child.pid, startedAt: Date.now() }),
    'utf8',
  )
} finally {
  closeSync(stdout)
  closeSync(stderr)
}
