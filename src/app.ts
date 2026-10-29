import Fastify from 'fastify'
import { buscarFilmes } from './external-api.ts'
import type { ApiOptions } from './external-api.ts'
import { transformarFilme } from './filmes.ts'
import { isRecord } from './validation.ts'

interface AppOptions extends ApiOptions {
    logger?: boolean
}

export function buildApp(options: AppOptions = {}) {
    const app = Fastify({ logger: options.logger ?? false })

    app.get('/filmes', async (request, reply) => {
        try {
            const filmes = await buscarFilmes(options)
            return { filmes: filmes.map(transformarFilme) }
        } catch (error) {
            request.log.error({ err: error }, 'Falha ao obter filmes')
            const status =
                isRecord(error) && error.statusCode === 504 ? 504 : 502
            return reply.code(status).send({
                erro:
                    status === 504
                        ? 'Tempo limite excedido ao consultar a API de filmes.'
                        : 'Não foi possível obter os filmes da API externa.',
            })
        }
    })

    return app
}
