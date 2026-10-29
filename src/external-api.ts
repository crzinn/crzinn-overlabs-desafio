import type { FilmeExterno } from './filmes.ts'
import { isRecord } from './validation.ts'

//optei por deixar a url no codigo por que nao precisa de autenticação, mas dessa forma abre margem pra trocar o endpoint apenas na env tambem caso o projeto cresca. 
export const FILMES_API_URL =
    process.env.API_URL ??
    'https://tv5hn2gvyijpl76yxlmsy66jwa0nlmxn.lambda-url.us-east-1.on.aws/'

export const DEFAULT_TIMEOUT_MS = 5_000

export interface ApiOptions {
    fetchImpl?: typeof fetch
    timeoutMs?: number
}

export async function buscarFilmes({
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiOptions = {}): Promise<FilmeExterno[]> {
    const signal = AbortSignal.timeout(timeoutMs)

    try {
        const response = await fetchImpl(FILMES_API_URL, { signal })
        if (!response.ok) {
            await response.body?.cancel()
            throw new Error(`API externa respondeu HTTP ${response.status}`)
        }

        const data: unknown = await response.json()
        if (
            !isRecord(data) ||
            !Array.isArray(data.filmes) ||
            !data.filmes.every(isRecord)
        ) {
            throw new Error('API externa retornou estrutura incompatível')
        }

        return data.filmes
    } catch (cause) {
        const timeout =
            signal.aborted ||
            (cause instanceof Error && cause.name === 'TimeoutError')
        throw Object.assign(
            new Error('Falha ao consultar API de filmes', { cause }),
            {
                statusCode: timeout ? 504 : 502,
            },
        )
    }
}
