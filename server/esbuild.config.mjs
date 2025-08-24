import { build, context } from 'esbuild'

const isWatch = process.argv.includes('--watch')

const commonOptions = {
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  sourcemap: true,
  target: 'node22',
  splitting: true,
  banner: {
    js: 'import { createRequire as __createRequire } from "module"; const require = __createRequire(import.meta.url);'
  },
  external: [
    '@fastify/*',
    'ssh2',
    'simple-git',
    'dotenv',
    'js-yaml',
    'marked',
    'node-cron',
    'highlight.js',
    'yaml',
    'zod'
  ],
  logLevel: 'info'
}

async function run() {
  const options = {
    ...commonOptions,
    minify: !isWatch
  }

  if (isWatch) {
    const ctx = await context(options)
    await ctx.watch()
    // Keep process alive in watch mode
    console.log('[esbuild] watching...')
  } else {
    await build(options)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})


