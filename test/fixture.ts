import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import type { FilmeExterno } from '../src/filmes.ts'
import { isRecord } from '../src/validation.ts'

export async function loadFixture(): Promise<{ filmes: FilmeExterno[] }> {
    const value: unknown = JSON.parse(
        await readFile(new URL('../filmes.json', import.meta.url), 'utf8'),
    )
    assert.ok(
        isRecord(value) &&
            Array.isArray(value.filmes) &&
            value.filmes.every(isRecord),
    )
    return { filmes: value.filmes }
}
