/**
 * Icon Assets - Base64 encoded images for app icons
 *
 * These are placeholder SVG data URIs. Replace with actual PNG base64 data:
 * export const ICON_IMAGES = {
 *   tasks: 'data:image/png;base64,<actual-base64-data>',
 *   ...
 * };
 *
 * To convert a PNG to base64:
 * - Node.js: Buffer.from(fs.readFileSync('icon.png')).toString('base64')
 * - CLI: base64 -i icon.png
 * - Online: https://base64.guru/converter/encode/image
 */

export const ICON_IMAGES = {
  // Tasks icon - checklist
  tasks: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`)}`,

  // Scan icon - barcode scanner
  scan: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="17" y2="8"/><line x1="7" y1="16" x2="10" y2="16"/><line x1="14" y1="16" x2="17" y2="16"/></svg>`)}`,

  // Damaged package icon - broken box
  damagedPackage: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/><path d="M10 4 8 8l4 2-2 4"/></svg>`)}`,

  // Damage icon - warning triangle with crack
  damage: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`)}`,

  // Claims icon - document with badge
  claims: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`)}`,
} as const;

export type IconName = keyof typeof ICON_IMAGES;

/**
 * Get all available icon names
 */
export const getIconNames = (): IconName[] => {
  return Object.keys(ICON_IMAGES) as IconName[];
};
