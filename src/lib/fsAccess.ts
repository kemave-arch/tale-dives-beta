// §6.4B Local Save — "On-Device Folder" via the File System Access API
// (Chrome/Edge desktop only; iOS/Android and Firefox/Safari have no support
// and fall back to "Browser Only" per the blueprint's own platform matrix).
// No persistence library — a directory handle is stored in a small
// dedicated IndexedDB store since localStorage can't hold structured-clone
// objects like a FileSystemDirectoryHandle.
const DB_NAME = 'tale-dives-fs'
const STORE_NAME = 'handles'
const HANDLE_KEY = 'saveDir'

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Opens the native folder picker (requires a real user gesture — call this
// directly from a click handler, never from an effect) and remembers the
// choice across sessions. Returns null on unsupported browsers or if the
// player cancels the picker — neither is an error worth surfacing.
export async function pickSaveFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFileSystemAccess()) return null
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    await idbSet(HANDLE_KEY, handle)
    return handle
  } catch {
    return null
  }
}

export async function forgetSaveFolder(): Promise<void> {
  await idbDelete(HANDLE_KEY)
}

// Re-loads the remembered handle and re-confirms permission — a granted
// handle's permission does not survive a page reload, but re-prompting
// needs a user gesture, so this only checks the already-granted state
// silently; a lapsed permission means the caller should re-link explicitly
// via requestFolderPermission (from a click handler) rather than this.
export async function loadSaveFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFileSystemAccess()) return null
  const handle = await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY)
  if (!handle) return null
  try {
    const status = await handle.queryPermission({ mode: 'readwrite' })
    return status === 'granted' ? handle : null
  } catch {
    return null
  }
}

// Re-prompts for permission on a remembered handle whose grant has lapsed.
// Must be called from a user gesture (a click handler).
export async function requestFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const status = await handle.requestPermission({ mode: 'readwrite' })
    return status === 'granted'
  } catch {
    return false
  }
}

export async function getRememberedFolderHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return idbGet<FileSystemDirectoryHandle>(HANDLE_KEY)
}

// Writes (creates or overwrites) one file directly into the linked folder.
export async function writeFileToFolder(handle: FileSystemDirectoryHandle, filename: string, contents: string): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(contents)
  await writable.close()
}
