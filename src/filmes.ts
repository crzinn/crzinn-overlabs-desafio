import { formatMoney, parseMoney } from './money.ts'
import { isFiniteNumber, isNonEmptyText, isRecord } from './validation.ts'

// Campos externos continuam unknown até a validação de cada transformação.
export type FilmeExterno = Record<string, unknown>

export interface FilmeTransformado extends Record<string, unknown> {
    lucro: string | null
    maiorPremiacao: string | null
    duracaoSegundos: number | null
    notaIMDb: string | null
    sinopse: string | null
}

interface Premio {
    nome: string
    relevancia: number
}

interface Sinopse {
    texto: string
    idioma: string
}

function maiorPremiacao(value: unknown): string | null {
    if (!Array.isArray(value)) return null

    let maior: Premio | null = null
    for (const premio of value as unknown[]) {
        if (
            !isRecord(premio) ||
            !isNonEmptyText(premio.nome) ||
            !isFiniteNumber(premio.relevancia)
        )
            continue
        if (maior === null || premio.relevancia > maior.relevancia) {
            maior = { nome: premio.nome, relevancia: premio.relevancia }
        }
    }
    return maior?.nome ?? null
}

function notaIMDb(value: unknown): string | null {
    if (!Array.isArray(value)) return null

    for (const rating of value as unknown[]) {
        if (!isRecord(rating) || !isNonEmptyText(rating.fonte)) continue
        if (rating.fonte.trim().toLowerCase() !== 'imdb') continue
        if (isFiniteNumber(rating.valor)) return String(rating.valor)
        if (
            isNonEmptyText(rating.valor) &&
            /^\d+(?:[.,]\d+)?$/.test(rating.valor.trim())
        ) {
            return rating.valor.trim()
        }
    }
    return null
}

function selecionarSinopse(value: unknown): string | null {
    if (!Array.isArray(value)) return null

    const sinopses: Sinopse[] = []
    for (const sinopse of value as unknown[]) {
        if (
            isRecord(sinopse) &&
            isNonEmptyText(sinopse.texto) &&
            isNonEmptyText(sinopse.idioma)
        ) {
            sinopses.push({
                texto: sinopse.texto,
                idioma: sinopse.idioma.trim().toLowerCase(),
            })
        }
    }

    return (
        (
            sinopses.find(({ idioma }) => idioma === 'pt-br') ??
            sinopses.find(({ idioma }) => idioma === 'en') ??
            sinopses[0]
        )?.texto ?? null
    )
}

export function transformarFilme(filme: FilmeExterno): FilmeTransformado {
    const { locacoes, poster, trailer, ...preservado } = filme
    const orcamento = parseMoney(filme.orcamento)
    const bilheteria = parseMoney(filme.bilheteria)
    const segundos =
        isFiniteNumber(filme.duracao) && filme.duracao >= 0
            ? filme.duracao * 60
            : null

    return {
        ...preservado,
        lucro:
            orcamento !== null && bilheteria !== null
                ? formatMoney(bilheteria - orcamento)
                : null,
        maiorPremiacao: maiorPremiacao(filme.premios),
        duracaoSegundos: isFiniteNumber(segundos) ? segundos : null,
        notaIMDb: notaIMDb(filme.ratings),
        sinopse: selecionarSinopse(filme.sinopse),
    }
}
