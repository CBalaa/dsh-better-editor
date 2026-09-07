/** Basename of a '/'-separated path. */
export function baseName(path: string): string {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const slash = trimmed.lastIndexOf('/')
  return slash === -1 ? trimmed : trimmed.slice(slash + 1)
}

/** One path relative to a base directory ('' when outside/unrelated). */
export function relativeTo(base: string, path: string): string {
  if (base === '' || path === base) return baseName(path)
  const prefix = base.endsWith('/') ? base : `${base}/`
  if (path.startsWith(prefix)) return path.slice(prefix.length)
  return path
}