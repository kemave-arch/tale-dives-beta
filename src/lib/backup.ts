import { loadSaveFolder, writeFileToFolder } from './fsAccess.ts'

// Blueprint §6.4B Load User Files — plain browser download/upload, no server.
export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function readJSONFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// §6.4B Local Save — writes directly into the linked On-Device Folder when
// one is currently linked and its permission is still granted; otherwise
// falls back to the plain browser download exactly as before. Same call
// shape as downloadJSON, so every existing Export call site only needs an
// `await` added. Returns which path was actually used, for a UI toast/note
// if a caller wants one (none currently do).
export async function saveJSON(filename: string, data: unknown): Promise<'folder' | 'download'> {
  const folder = await loadSaveFolder()
  if (folder) {
    try {
      await writeFileToFolder(folder, filename, JSON.stringify(data, null, 2))
      return 'folder'
    } catch {
      // permission revoked mid-session, disk full, etc. — fall through to download rather than losing the save
    }
  }
  downloadJSON(filename, data)
  return 'download'
}
