import { buildApp } from './app.ts'

const app = buildApp({ logger: true })

try {
    const port = Number(process.env.PORT ?? 3000)
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('PORT deve ser um inteiro entre 1 e 65535')
    }
    await app.listen({ port, host: '127.0.0.1' })
} catch (error) {
    app.log.error(error)
    process.exitCode = 1
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
        app.close().catch((error: unknown) => {
            app.log.error(error)
            process.exitCode = 1
        })
    })
}
