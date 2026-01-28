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

  // Claim clipboard icon - clipboard with "CLAIM" text
  claimClipboard: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#7c3aed" stroke-width="1.5" fill="#f5f3ff"/><rect x="8" y="1" width="8" height="4" rx="1" stroke="#7c3aed" stroke-width="1.5" fill="#fff"/><rect x="7" y="8" width="10" height="3" rx="0.5" fill="#7c3aed"/><text x="12" y="10.5" font-family="Arial" font-size="3" font-weight="bold" fill="#fff" text-anchor="middle">CLAIM</text><line x1="7" y1="14" x2="17" y2="14" stroke="#7c3aed" stroke-width="1"/><line x1="7" y1="16.5" x2="14" y2="16.5" stroke="#7c3aed" stroke-width="1"/><line x1="7" y1="19" x2="11" y2="19" stroke="#7c3aed" stroke-width="1"/></svg>`)}`,

  // Broken furniture icon - cracked table
  brokenFurniture: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="3" rx="0.5" fill="#d4a574" stroke="#8b5a2b" stroke-width="1"/><path d="M5 10 L5 20" stroke="#8b5a2b" stroke-width="2" stroke-linecap="round"/><path d="M19 10 L19 20" stroke="#8b5a2b" stroke-width="2" stroke-linecap="round"/><path d="M10 8 L11 5 L12.5 9 L13.5 6 L14 8" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="11" cy="4" r="1.5" fill="#fbbf24"/><path d="M9.5 3 L8.5 2" stroke="#fbbf24" stroke-width="1" stroke-linecap="round"/><path d="M12.5 3 L13.5 2" stroke="#fbbf24" stroke-width="1" stroke-linecap="round"/><path d="M11 2.5 L11 1.5" stroke="#fbbf24" stroke-width="1" stroke-linecap="round"/></svg>`)}`,

  // Damaged box icon - crushed cardboard box
  damagedBox: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M4 8 L12 4 L20 8 L20 18 L12 22 L4 18 Z" fill="#e5d4b3" stroke="#8b6914" stroke-width="1.5"/><path d="M12 4 L12 22" stroke="#8b6914" stroke-width="1" stroke-dasharray="2 1"/><path d="M4 8 L12 12 L20 8" stroke="#8b6914" stroke-width="1"/><path d="M6 10 L7 13 L5 15 L8 16" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 9 L16 12 L14 14" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 19 L11 17 L10 20" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="17" cy="6" rx="3" ry="2" fill="#fef3c7" stroke="#f59e0b" stroke-width="1"/><text x="17" y="7" font-family="Arial" font-size="3" font-weight="bold" fill="#f59e0b" text-anchor="middle">!</text></svg>`)}`,

  // Barcode scanner icon - handheld scanner device
  barcodeScanner: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="6" y="2" width="12" height="8" rx="1" fill="#374151" stroke="#1f2937" stroke-width="1"/><rect x="7" y="3" width="10" height="5" rx="0.5" fill="#60a5fa"/><rect x="8" y="10" width="8" height="12" rx="1" fill="#4b5563" stroke="#1f2937" stroke-width="1"/><circle cx="12" cy="19" r="1.5" fill="#1f2937"/><rect x="9" y="12" width="6" height="4" rx="0.5" fill="#9ca3af"/><line x1="10" y1="13" x2="10" y2="15" stroke="#374151" stroke-width="0.5"/><line x1="11" y1="13" x2="11" y2="15" stroke="#374151" stroke-width="1"/><line x1="12" y1="13" x2="12" y2="15" stroke="#374151" stroke-width="0.5"/><line x1="13" y1="13" x2="13" y2="15" stroke="#374151" stroke-width="1"/><line x1="14" y1="13" x2="14" y2="15" stroke="#374151" stroke-width="0.5"/><path d="M3 5 L6 5" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><path d="M3 5 L3 3" stroke="#ef4444" stroke-width="1" stroke-linecap="round" opacity="0.5"/></svg>`)}`,

  // Checklist icon - clipboard with checkmarks
  checklist: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#374151" stroke-width="1.5" fill="#fff"/><rect x="8" y="1" width="8" height="4" rx="1" stroke="#374151" stroke-width="1.5" fill="#f3f4f6"/><circle cx="8" cy="9" r="1.5" fill="#22c55e"/><path d="M7.2 9 L7.8 9.6 L9 8.4" stroke="#fff" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="11" y1="9" x2="17" y2="9" stroke="#374151" stroke-width="1"/><circle cx="8" cy="13" r="1.5" fill="#22c55e"/><path d="M7.2 13 L7.8 13.6 L9 12.4" stroke="#fff" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="11" y1="13" x2="17" y2="13" stroke="#374151" stroke-width="1"/><circle cx="8" cy="17" r="1.5" fill="#dc2626"/><path d="M7.2 17 L7.8 17.6 L9 16.4" stroke="#fff" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="11" y1="17" x2="17" y2="17" stroke="#374151" stroke-width="1"/></svg>`)}`,

  // Inspection icon - magnifying glass over document
  inspection: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="12" height="16" rx="1" fill="#fff" stroke="#374151" stroke-width="1.5"/><line x1="5" y1="7" x2="13" y2="7" stroke="#374151" stroke-width="1"/><line x1="5" y1="10" x2="13" y2="10" stroke="#374151" stroke-width="1"/><line x1="5" y1="13" x2="10" y2="13" stroke="#374151" stroke-width="1"/><circle cx="16" cy="14" r="4" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><line x1="19" y1="17" x2="22" y2="20" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/></svg>`)}`,

  // Repair icon - wrench and screwdriver
  repair: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/><path d="M5 3 L3 5 L10 12" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="4" r="1" fill="#ef4444"/></svg>`)}`,
} as const;

export type IconName = keyof typeof ICON_IMAGES;

/**
 * Get all available icon names
 */
export const getIconNames = (): IconName[] => {
  return Object.keys(ICON_IMAGES) as IconName[];
};
