// Minimal ambient types for the File System Access API — not yet part of
// TypeScript's bundled DOM lib. Scoped to only what src/lib/fsAccess.ts
// actually uses; not a full replacement for @types/wicg-file-system-access.
export {}

declare global {
  type FileSystemPermissionMode = 'read' | 'readwrite'

  interface FileSystemHandlePermissionDescriptor {
    mode?: FileSystemPermissionMode
  }

  interface FileSystemDirectoryHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  }

  interface DirectoryPickerOptions {
    mode?: FileSystemPermissionMode
  }

  interface Window {
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
  }
}
