import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import firebaseConfig from '../../firebase-applet-config.json'

export type { User }

// Scopes required for Google Drive app files
export const SCOPES = ['https://www.googleapis.com/auth/drive.file']

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)

const provider = new GoogleAuthProvider()
provider.addScope('https://www.googleapis.com/auth/drive.file')
// Prompt user to select an account
provider.setCustomParameters({ prompt: 'select_account' })

// Memory-only access token cache (do NOT store in localStorage per security rule)
let cachedAccessToken: string | null = null
let isSigningIn = false

export function isGoogleSigningIn(): boolean {
  return isSigningIn
}

// signInWithPopup is documented to be unreliable specifically on mobile web:
// many mobile Safari/Chrome/in-app-webview contexts block window.open
// outright, often WITHOUT a catchable error — the popup just flashes open
// and immediately closes, and the promise never settles (this is the
// "screen flickers, nothing happens" bug reported live on a real phone).
// "try popup, catch the error, fall back to redirect" only fixes the
// browsers that DO throw cleanly; it silently misses the ones that don't.
// So a detected mobile browser skips the popup attempt entirely rather
// than gambling on which failure mode it'll hit.
function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const uaData = (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uaData?.mobile !== undefined) return uaData.mobile
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

// signInWithRedirect navigates away and back — there's no token to return
// synchronously to whoever tapped "Sign In"/"Backup Now", only once the app
// reloads and this resolves. Call once at app boot (before anything else
// touches Google auth state) so a token picked up this way is already
// cached by the time any screen asks for it.
export async function completeGoogleRedirectSignIn(): Promise<{ user: User; accessToken: string } | null> {
  try {
    const result = await getRedirectResult(auth)
    if (!result) return null
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (!credential?.accessToken) return null
    cachedAccessToken = credential.accessToken
    return { user: result.user, accessToken: cachedAccessToken }
  } catch (err) {
    console.error('Google redirect sign-in error:', err)
    return null
  }
}

export interface GoogleDriveFile {
  id: string
  name: string
  createdTime?: string
  modifiedTime?: string
  size?: string
}

export function initGoogleAuth(
  onUserChanged?: (user: User | null, hasToken: boolean) => void
): () => void {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      onUserChanged?.(user, true)
    } else if (user) {
      // User is logged into Firebase, but access token might need re-prompt if expired or page refreshed
      onUserChanged?.(user, !!cachedAccessToken)
    } else {
      cachedAccessToken = null
      onUserChanged?.(null, false)
    }
  })
}

// Errors that mean "no popup could be shown at all" rather than "the user
// declined" — only these fall back to a redirect; a user-closed popup
// should stay a user-closed popup, not silently become a full navigation.
const POPUP_UNAVAILABLE_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
])

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  isSigningIn = true
  const inIframe = typeof window !== 'undefined' && window.self !== window.top

  // Mobile: go straight to redirect, never attempt the popup — see
  // isMobileBrowser's comment on why catching a popup failure isn't a
  // reliable enough signal there. Redirect can't work from inside an
  // iframe either (same-origin top-level navigation is what it needs), so
  // that combination surfaces as an explicit message instead of a silent
  // navigation attempt that would just fail against the embedding page.
  if (isMobileBrowser() && !inIframe) {
    await signInWithRedirect(auth, provider)
    // Unreachable in practice — signInWithRedirect navigates the page away.
    isSigningIn = false
    throw new Error('Redirecting to Google sign-in...')
  }

  try {
    const result = await signInWithPopup(auth, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (!credential?.accessToken) {
      throw new Error('Failed to acquire Google Drive access token')
    }
    cachedAccessToken = credential.accessToken
    return { user: result.user, accessToken: cachedAccessToken }
  } catch (err: any) {
    const code = err?.code as string | undefined

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw err
    }

    if (code && POPUP_UNAVAILABLE_CODES.has(code)) {
      if (!inIframe) {
        await signInWithRedirect(auth, provider)
        throw new Error('Redirecting to Google sign-in...')
      } else {
        throw new Error('Pop-up was blocked by your browser. Please allow pop-ups for this site or open in a new window.')
      }
    }

    console.error('Google sign-in error:', err)
    throw err
  } finally {
    isSigningIn = false
  }
}

export async function signOutGoogle(): Promise<void> {
  await auth.signOut()
  cachedAccessToken = null
}

export async function getGoogleAccessToken(): Promise<string | null> {
  return cachedAccessToken
}

export function getCurrentGoogleUser(): User | null {
  return auth.currentUser
}

/**
 * Upload a JSON backup file to Google Drive using multipart upload.
 * Maintains up to 3 versions by overwriting the oldest one if 3 already exist.
 */
export async function uploadBackupToDrive(
  data: unknown
): Promise<GoogleDriveFile> {
  let token = cachedAccessToken
  if (!token) {
    const authResult = await signInWithGoogle()
    token = authResult.accessToken
  }

  let existingId: string | null = null
  let filename = 'tale-dives-backup-1.json'

  try {
    const files = await listDriveBackups(true)
    if (files.length >= 3) {
      // files are sorted by modifiedTime desc, so the last is the oldest
      const oldest = files[files.length - 1]
      existingId = oldest.id
      filename = oldest.name
    } else {
      const used = new Set(files.map(f => f.name))
      for (let i = 1; i <= 3; i++) {
        const name = `tale-dives-backup-${i}.json`
        const legacyName = i === 1 ? 'tale-dives-backup.json' : name
        // prefer overwriting legacy name if it exists but we need a slot
        const legacyMatch = files.find(f => f.name === 'tale-dives-backup.json')
        if (legacyMatch && i === 1) {
            existingId = legacyMatch.id
            filename = legacyMatch.name
            break
        }
        if (!used.has(name) && !used.has(legacyName)) {
          filename = name
          break
        }
      }
    }
  } catch (err) {
    console.warn('[GoogleDrive] Could not check existing files, creating new:', err)
  }

  const boundary = '-------TaleDivesDriveBoundary' + Date.now().toString(36)
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    description: `Tale Dives Save Backup (${new Date().toLocaleString()})`,
  }

  const jsonContent = JSON.stringify(data, null, 2)

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonContent +
    closeDelimiter

  const endpoint = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

  const method = existingId ? 'PATCH' : 'POST'

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to upload to Google Drive: ${response.status} ${errorText}`)
  }

  return response.json()
}

/**
 * List existing Tale Dives backup files from Google Drive.
 * Set silent = true to avoid throwing or prompting sign-in if not currently authenticated.
 */
export async function listDriveBackups(silent = false): Promise<GoogleDriveFile[]> {
  let token = cachedAccessToken
  if (!token) {
    if (silent) return []
    const authResult = await signInWithGoogle()
    token = authResult.accessToken
  }

  const query = encodeURIComponent("name contains 'tale-dives' and trashed=false")
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,modifiedTime,size)&orderBy=modifiedTime desc`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null
      if (silent) return []
    }
    const errorText = await response.text()
    throw new Error(`Failed to fetch files from Google Drive: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data.files ?? []
}

/**
 * Download a backup file's JSON content from Google Drive
 */
export async function downloadDriveBackup(fileId: string): Promise<any> {
  let token = cachedAccessToken
  if (!token) {
    const authResult = await signInWithGoogle()
    token = authResult.accessToken
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to download file from Google Drive: ${response.status} ${errorText}`)
  }

  return response.json()
}
