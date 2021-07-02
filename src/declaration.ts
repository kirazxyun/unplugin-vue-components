import { resolve, dirname, relative } from 'path'
import { promises as fs, existsSync } from 'fs'
import { notNullish, slash } from '@antfu/utils'
import { Context } from './context'

export function parseDeclaration(code: string): Record<string, string> {
  return Object.fromEntries(Array.from(code.matchAll(/\s+['"]?(.+?)['"]?:\s(.+?)\n/g)).map(i => [i[1], i[2]]))
}

export async function generateDeclaration(ctx: Context, root: string, filepath: string) {
  const imports: Record<string, string> = Object.fromEntries(
    Object.values({
      ...ctx.componentNameMap,
      ...ctx.componentCustomMap,
    })
      .map(({ path, name, importName }) => {
        if (!name)
          return undefined

        const related = slash(path).startsWith('/')
          ? `./${relative(dirname(filepath), resolve(root, path.slice(1)))}`
          : path

        let entry = `typeof import('${slash(related)}')`
        if (importName)
          entry += `['${importName}']`
        else
          entry += '[\'default\']'
        return [name, entry]
      })
      .filter(notNullish),
  )

  if (!Object.keys(imports).length)
    return

  const originalImports = existsSync(filepath)
    ? parseDeclaration(await fs.readFile(filepath, 'utf-8'))
    : {}

  const lines = Object.entries({
    ...originalImports,
    ...imports,
  })
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, v]) => {
      if (!/^\w+$/.test(name))
        name = `'${name}'`
      return `${name}: ${v}`
    })

  const code = `// generated by vite-plugin-components
// read more https://github.com/vuejs/vue-next/pull/3399

declare module 'vue' {
  export interface GlobalComponents {
    ${lines.join('\n    ')}
  }
}

export { }
`
  await fs.writeFile(filepath, code, 'utf-8')
}
