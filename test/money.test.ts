import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMoney, parseMoney } from '../src/money.ts'

test('interpreta magnitudes, singular/plural e separadores encontrados nos filmes', () => {
    const cases: [string, bigint][] = [
        ['$6 milhões', 600_000_000n],
        ['$1 milhão', 100_000_000n],
        ['$3.3 milhões', 330_000_000n],
        ['$3,3 milhões', 330_000_000n],
        ['$1.142 bilhão', 114_200_000_000n],
        ['$2.208 bilhões', 220_800_000_000n],
        ['$2 bilhões', 200_000_000_000n],
        [' $ 0 MILHÕES ', 0n],
        ['$0.000001 milhão', 100n],
        ['$0.00000001 milhão', 1n],
        ['$0.00000000001 bilhão', 1n],
        ['$1234', 123_400n],
        ['$1.234.567,89', 123_456_789n],
        ['$0,1', 10n],
    ]

    for (const [input, expected] of cases) {
        assert.equal(parseMoney(input), expected, input)
    }
})

test('rejeita valores monetários ausentes, ambíguos, inválidos ou menores que um centavo', () => {
    const invalid: unknown[] = [
        undefined,
        null,
        123,
        NaN,
        {},
        '',
        'desconhecido',
        '6 milhões',
        '$-6 milhões',
        '$1 trilhão',
        '$1,2.3 milhões',
        '$1.000.000 milhões',
        '$NaN milhões',
        '$Infinity bilhões',
        '$0.000000001 milhão',
        '$1,2345',
    ]
    for (const input of invalid)
        assert.equal(parseMoney(input), null, String(input))
})

test('formata centavos exatos, incluindo negativos, zero e valores grandes', () => {
    assert.equal(formatMoney(199_400_000_000n), '$1,994 bilhão')
    assert.equal(formatMoney(-123_456n), '-$1.234,56')
    assert.equal(formatMoney(0n), '$0,00')
    assert.equal(formatMoney(1n), '$0,01')
    assert.equal(
        formatMoney(900_719_925_474_099_301n),
        '$9007199,25474099301 bilhões',
    )
})

test('escolhe a magnitude pelo valor absoluto, sem arredondar nos limites', () => {
    const cases: [bigint, string][] = [
        [99_999_999n, '$999.999,99'],
        [100_000_000n, '$1 milhão'],
        [100_000_001n, '$1,00000001 milhão'],
        [150_000_000n, '$1,5 milhão'],
        [-150_000_000n, '-$1,5 milhão'],
        [200_000_000n, '$2 milhões'],
        [99_999_999_999n, '$999,99999999 milhões'],
        [100_000_000_000n, '$1 bilhão'],
        [100_000_000_001n, '$1,00000000001 bilhão'],
        [-100_000_000_000n, '-$1 bilhão'],
        [200_000_000_000n, '$2 bilhões'],
    ]

    for (const [cents, expected] of cases) {
        assert.equal(formatMoney(cents), expected)
        // A apresentação preserva exatamente o valor calculado em centavos.
        const unsigned = formatMoney(cents < 0n ? -cents : cents)
        assert.equal(parseMoney(unsigned), cents < 0n ? -cents : cents)
    }
})
