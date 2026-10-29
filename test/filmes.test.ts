import assert from 'node:assert/strict'
import test from 'node:test'
import { transformarFilme } from '../src/filmes.ts'
import { loadFixture } from './fixture.ts'

test('calcula lucro positivo, negativo e zero, respeitando a fórmula do PDF', () => {
    const cases: [string, string, string][] = [
        ['$6 milhões', '$2 bilhões', '$1,994 bilhão'],
        ['$3.3 milhões', '$30 milhões', '$26,7 milhões'],
        ['$10 milhões', '$2 milhões', '-$8 milhões'],
        ['$1 bilhão', '$1000 milhões', '$0,00'],
        ['$0,10', '$0,30', '$0,20'],
    ]
    for (const [orcamento, bilheteria, expected] of cases) {
        assert.equal(
            transformarFilme({ orcamento, bilheteria }).lucro,
            expected,
        )
    }
})

test('escolhe a maior relevância, mantendo a primeira ocorrência no empate', () => {
    const premios = [
        { nome: 'Menor', relevancia: 2 },
        { nome: 'Primeira maior', relevancia: 10 },
        { nome: 'Segunda maior', relevancia: 10 },
        { nome: 'Intermediária', relevancia: 9 },
    ]
    assert.equal(transformarFilme({ premios }).maiorPremiacao, 'Primeira maior')
    assert.equal(
        transformarFilme({ premios: [{ nome: 'Válida', relevancia: -1 }] })
            .maiorPremiacao,
        'Válida',
    )
})

test('converte minutos em segundos, incluindo zero e minutos fracionários', () => {
    for (const [duracao, expected] of [
        [175, 10500],
        [0, 0],
        [1.5, 90],
    ]) {
        assert.equal(transformarFilme({ duracao }).duracaoSegundos, expected)
    }
    for (const duracao of ['175', -1, NaN, Infinity, Number.MAX_VALUE, null]) {
        assert.equal(transformarFilme({ duracao }).duracaoSegundos, null)
    }
})

test('obtém apenas a avaliação IMDb e devolve seu valor como string', () => {
    assert.equal(
        transformarFilme({
            ratings: [
                { fonte: 'Rotten Tomatoes', valor: 9.9 },
                { fonte: 'IMDb', valor: 9.2 },
            ],
        }).notaIMDb,
        '9.2',
    )
    assert.equal(
        transformarFilme({ ratings: [{ fonte: ' imdb ', valor: ' 8.6 ' }] })
            .notaIMDb,
        '8.6',
    )
    assert.equal(
        transformarFilme({ ratings: [{ fonte: 'IMDb', valor: 0 }] }).notaIMDb,
        '0',
    )
    for (const ratings of [
        [{ fonte: 'Rotten Tomatoes', valor: 9.9 }],
        [{ fonte: 'IMDb', valor: Infinity }],
        [{ fonte: 'IMDb', valor: 'sem nota' }],
        [{ fonte: 'IMDb', valor: '' }],
    ]) {
        assert.equal(transformarFilme({ ratings }).notaIMDb, null)
    }
})

test('prioriza pt-br, depois en e depois a primeira sinopse válida de outro idioma', () => {
    const pt = { idioma: 'PT-BR', texto: 'Texto brasileiro' }
    const en = { idioma: 'en', texto: 'English text' }
    const fr = { idioma: 'fr', texto: 'Texte français' }
    assert.equal(transformarFilme({ sinopse: [fr, en, pt] }).sinopse, pt.texto)
    assert.equal(
        transformarFilme({
            sinopse: [fr, { idioma: 'pt-br', texto: '  ' }, en],
        }).sinopse,
        en.texto,
    )
    assert.equal(
        transformarFilme({
            sinopse: [{ idioma: 'en' }, fr, { idioma: 'es', texto: 'Español' }],
        }).sinopse,
        fr.texto,
    )
    assert.equal(
        transformarFilme({ sinopse: [{ idioma: 'pt-br', texto: '' }, null] })
            .sinopse,
        null,
    )
    assert.equal(
        transformarFilme({ sinopse: [{ texto: 'Sem idioma' }] }).sinopse,
        null,
    )
})

test('remove exatamente locacoes, poster e trailer, preservando campos e entrada original', () => {
    const original = {
        titulo: 'Filme',
        duracao: 90,
        ratings: [],
        premios: [],
        elenco: ['Atriz'],
        orcamento: '$1 milhão',
        bilheteria: '$2 milhões',
        sinopse: [{ idioma: 'en', texto: 'Synopsis' }],
        locacoes: ['Local'],
        poster: 'poster.jpg',
        trailer: 'trailer.mp4',
        campoExtra: { detalhes: true },
    }
    const before = structuredClone(original)
    const result = transformarFilme(original)
    const removed = ['locacoes', 'poster', 'trailer']

    for (const [key, value] of Object.entries(original)) {
        if (removed.includes(key))
            assert.equal(Object.hasOwn(result, key), false)
        else if (key !== 'sinopse') assert.deepEqual(result[key], value, key)
    }
    assert.deepEqual(
        Object.keys(result).sort(),
        [
            ...Object.keys(original).filter(key => !removed.includes(key)),
            'lucro',
            'maiorPremiacao',
            'duracaoSegundos',
            'notaIMDb',
        ].sort(),
    )
    assert.equal(result.sinopse, 'Synopsis')
    assert.deepEqual(original, before)
})

test('usa null em transformações impossíveis e ignora itens inválidos dentro de arrays', () => {
    const expected = {
        lucro: null,
        maiorPremiacao: null,
        duracaoSegundos: null,
        notaIMDb: null,
        sinopse: null,
    }
    assert.deepEqual(transformarFilme({}), expected)

    const invalid = transformarFilme({
        orcamento: '$1 milhão',
        bilheteria: 'desconhecida',
        duracao: '90',
        premios: {},
        ratings: 'IMDb',
        sinopse: 'Texto fora do array',
    })
    for (const [key, value] of Object.entries(expected))
        assert.equal(invalid[key], value, key)

    const mixed = transformarFilme({
        premios: [
            null,
            [],
            { nome: '', relevancia: 99 },
            { nome: 'Inválido', relevancia: NaN },
            { nome: 'Oscar', relevancia: 10 },
        ],
        ratings: [null, { fonte: 42, valor: 10 }, { fonte: 'IMDb', valor: 8 }],
        sinopse: [
            null,
            { idioma: 'pt-br', texto: 42 },
            { idioma: 'en', texto: 'Valid' },
        ],
    })
    assert.equal(mixed.maiorPremiacao, 'Oscar')
    assert.equal(mixed.notaIMDb, '8')
    assert.equal(mixed.sinopse, 'Valid')
    const empty = transformarFilme({ premios: [], ratings: [], sinopse: [] })
    assert.equal(empty.maiorPremiacao, null)
    assert.equal(empty.notaIMDb, null)
    assert.equal(empty.sinopse, null)
})

test('transforma os oito filmes reais da fixture, incluindo bilhões e fallbacks de idioma', async () => {
    const { filmes } = await loadFixture()
    const before = structuredClone(filmes)
    const results = filmes.map(transformarFilme)
    assert.equal(results.length, 8)
    assert.deepEqual(
        results.map(({ lucro }) => lucro),
        [
            '$239 milhões',
            '$512 milhões',
            '$1,048 bilhão',
            '$400 milhões',
            '$26,7 milhões',
            '$668 milhões',
            '$2,008 bilhões',
            '$38 milhões',
        ],
    )
    assert.equal(
        results[2]?.sinopse,
        'The Fellowship of the Ring prepares for the final battle against Sauron to save Middle-earth.',
    )
    assert.equal(
        results[3]?.sinopse,
        "Un hacker découvre la vraie nature de la réalité et lutte contre une intelligence artificielle qui asservit l'humanité.",
    )
    for (const filme of results) {
        for (const key of [
            'lucro',
            'maiorPremiacao',
            'duracaoSegundos',
            'notaIMDb',
            'sinopse',
        ]) {
            assert.notEqual(filme[key], null, `${filme.titulo}: ${key}`)
        }
    }
    assert.deepEqual(filmes, before)
})
