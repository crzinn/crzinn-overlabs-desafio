import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { buildApp } from '../src/app.ts'
import { FILMES_API_URL } from '../src/external-api.ts'
import { isRecord } from '../src/validation.ts'
import { loadFixture } from './fixture.ts'

async function requestFilmes(
    t: TestContext,
    fetchImpl: typeof fetch,
    timeoutMs = 5_000,
) {
    const app = buildApp({ fetchImpl, timeoutMs })
    t.after(async () => {
        await app.close()
    })
    return app.inject({ method: 'GET', url: '/filmes' })
}

test('GET /filmes consulta o endereço real com timeout e responde 200 com filmes transformados', async t => {
    const fixture = await loadFixture()
    let calls = 0
    const response = await requestFilmes(t, async (url, options) => {
        calls++
        assert.equal(url, FILMES_API_URL)
        assert.ok(options?.signal instanceof AbortSignal)
        assert.equal(options.signal.aborted, false)
        return Response.json(fixture)
    })

    assert.equal(calls, 1)
    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-type'] ?? '', /application\/json/)
    const body: unknown = response.json()
    assert.ok(isRecord(body) && Array.isArray(body.filmes))
    assert.equal(body.filmes.length, 8)
    const first: unknown = body.filmes[0]
    assert.ok(isRecord(first))
    assert.equal(first.titulo, 'O Poderoso Chefão')
    assert.equal(first.lucro, '$239 milhões')
    assert.equal(first.duracaoSegundos, 10500)
    assert.equal(first.notaIMDb, '9.2')
    assert.equal(first.maiorPremiacao, 'Oscar de Melhor Filme')
    assert.equal(
        first.sinopse,
        'Um chefão da máfia tenta transferir o controle de seu império clandestino para seu filho relutante.',
    )
    assert.equal(first.duracao, 175)
    for (const key of ['locacoes', 'poster', 'trailer'])
        assert.equal(Object.hasOwn(first, key), false)
})

test('GET /filmes aceita lista vazia e dados individuais incompletos', async t => {
    const empty = await requestFilmes(t, async () =>
        Response.json({ filmes: [] }),
    )
    assert.equal(empty.statusCode, 200)
    assert.deepEqual(empty.json(), { filmes: [] })

    const incomplete = await requestFilmes(t, async () =>
        Response.json({ filmes: [{ titulo: 'Incompleto' }] }),
    )
    assert.equal(incomplete.statusCode, 200)
    assert.deepEqual(incomplete.json(), {
        filmes: [
            {
                titulo: 'Incompleto',
                lucro: null,
                maiorPremiacao: null,
                duracaoSegundos: null,
                notaIMDb: null,
                sinopse: null,
            },
        ],
    })
})

test('GET /filmes responde 502 para falha de comunicação sem expor detalhes ou usar fixture', async t => {
    const response = await requestFilmes(t, async () => {
        throw new TypeError('Detalhe interno de rede')
    })
    assert.equal(response.statusCode, 502)
    assert.deepEqual(response.json(), {
        erro: 'Não foi possível obter os filmes da API externa.',
    })
})

test('GET /filmes responde 502 para status de erro na API externa', async t => {
    const response = await requestFilmes(
        t,
        async () => new Response('Falha interna externa', { status: 503 }),
    )
    assert.equal(response.statusCode, 502)
    assert.deepEqual(response.json(), {
        erro: 'Não foi possível obter os filmes da API externa.',
    })
})

test('GET /filmes responde 502 para JSON inválido', async t => {
    const response = await requestFilmes(
        t,
        async () => new Response('{ inválido'),
    )
    assert.equal(response.statusCode, 502)
})

test('GET /filmes rejeita estruturas gerais incompatíveis com 502', async t => {
    const invalid: unknown[] = [
        null,
        [],
        {},
        { filmes: {} },
        { filmes: [null] },
        { filmes: [[]] },
        { filmes: ['filme'] },
    ]
    for (const data of invalid) {
        const response = await requestFilmes(t, async () => Response.json(data))
        assert.equal(response.statusCode, 502, JSON.stringify(data))
    }
})

test('GET /filmes aborta a consulta após o timeout e responde 504', async t => {
    let requestSignal: AbortSignal | null | undefined
    const response = await requestFilmes(
        t,
        async (_url, options) => {
            requestSignal = options?.signal
            // O timer é abortável e mantém o event loop ativo até o timeout real do sinal.
            await setTimeout(10_000, undefined, {
                signal: requestSignal ?? undefined,
            })
            return Response.json({ filmes: [] })
        },
        10,
    )

    assert.equal(requestSignal?.aborted, true)
    assert.equal(response.statusCode, 504)
    assert.deepEqual(response.json(), {
        erro: 'Tempo limite excedido ao consultar a API de filmes.',
    })
})

test('GET /filmes também aplica timeout durante a leitura do corpo', async t => {
    const response = await requestFilmes(
        t,
        async (_url, options) => {
            const body = new ReadableStream<Uint8Array>({
                start(controller) {
                    // fetch real propaga o abort para o stream da resposta.
                    options?.signal?.addEventListener(
                        'abort',
                        () => {
                            controller.error(options.signal?.reason)
                        },
                        { once: true },
                    )
                },
            })
            // Mantém o event loop ativo enquanto o stream aguarda o sinal.
            const keepAlive = globalThis.setTimeout(() => {}, 10_000)
            options?.signal?.addEventListener(
                'abort',
                () => clearTimeout(keepAlive),
                { once: true },
            )
            return new Response(body)
        },
        10,
    )
    assert.equal(response.statusCode, 504)
})
