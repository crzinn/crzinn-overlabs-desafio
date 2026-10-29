// O retorno em centavos inteiros evita imprecisão de ponto flutuante.
export function parseMoney(value: unknown): bigint | null {
    if (typeof value !== 'string') return null

    const text = value.trim()
    const scaled =
        /^\$\s*(\d+)(?:[.,](\d+))?\s*(milhão|milhões|bilhão|bilhões)$/iu.exec(
            text,
        )

    if (scaled) {
        const [, integer = '', fraction = '', unit = ''] = scaled
        const magnitude = unit.toLowerCase().startsWith('bilh')
            ? 100_000_000_000n
            : 100_000_000n
        const numerator = BigInt(integer + fraction) * magnitude
        const denominator = 10n ** BigInt(fraction.length)

        // Não arredonda valores que exigiriam frações de centavo.
        return numerator % denominator === 0n ? numerator / denominator : null
    }

    // Sem magnitude: unidades inteiras ou notação brasileira, como $1.234,56.
    const unscaled = /^\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(
        text,
    )
    if (!unscaled) return null

    const [, integer = '', fraction = ''] = unscaled
    return (
        BigInt(integer.replaceAll('.', '')) * 100n +
        BigInt(fraction.padEnd(2, '0'))
    )
}

export function formatMoney(cents: bigint): string {
    const sign = cents < 0n ? '-' : ''
    const absolute = cents < 0n ? -cents : cents
    const magnitudes = [
        { scale: 100_000_000_000n, singular: 'bilhão', plural: 'bilhões' },
        { scale: 100_000_000n, singular: 'milhão', plural: 'milhões' },
    ]

    for (const { scale, singular, plural } of magnitudes) {
        if (absolute < scale) continue

        const integer = absolute / scale
        const fraction = (absolute % scale)
            .toString()
            .padStart(scale.toString().length - 1, '0')
            .replace(/0+$/, '')
        const amount = fraction ? `${integer},${fraction}` : String(integer)
        const unit = integer === 1n ? singular : plural
        return `${sign}$${amount} ${unit}`
    }

    const integer = (absolute / 100n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    const fraction = (absolute % 100n).toString().padStart(2, '0')
    return `${sign}$${integer},${fraction}`
}
