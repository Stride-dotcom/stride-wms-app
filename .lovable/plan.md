
# Plan: Replace Photo Capture with Document Scanner Camera Interface

## Overview
You want to use the interactive camera experience from `DocumentScanner` (live camera preview, capture button, multi-page capture, thumbnail strip, review mode) for photo capture in Shipment Detail, Task Detail, Claim Detail, and Item Photo Gallery instead of the current `MultiPhotoCapture` component.

## Current State
- **DocumentScanner**: Full-screen camera modal with live preview, capture button, thumbnail strip, and review mode. Creates PDFs and is designed for document scanning with OCR.
- **MultiPhotoCapture**: Inline component using native file input with `capture="environment"`. Takes photos directly through the device camera picker and uploads them individually.

## Proposed Solution
Create a new **PhotoScanner** component that combines:
- The camera UI experience from `DocumentScanner` (live preview, capture button, thumbnail strip, review mode)
- The photo storage behavior from `MultiPhotoCapture` (saves individual images to storage, not PDFs)

This gives you the best of both worlds: an interactive multi-photo capture experience that saves photos individually.

---

## Implementation Steps

### Step 1: Create PhotoScanner Component
Create `src/components/common/PhotoScanner.tsx` with:
- Full-screen dialog with live camera preview
- Capture button for taking photos
- Thumbnail strip showing captured photos
- Ability to remove photos before saving
- "Done" button to review and save
- Individual photo upload to Supabase storage (same as MultiPhotoCapture)
- Support for existing photos display

Key props:
- `open` / `onOpenChange` - Dialog control
- `entityType` - For storage path (item, shipment, task, claim)
- `entityId` / `tenantId` - For storage organization
- `existingPhotos` - Current saved photos
- `maxPhotos` - Limit
- `onPhotosSaved` - Callback with all photo URLs

### Step 2: Create PhotoScannerButton Component
A simple button component (`src/components/common/PhotoScannerButton.tsx`) that:
- Displays a "Take Photos" button
- Opens the PhotoScanner dialog when clicked
- Shows count of existing photos

### Step 3: Update ShipmentDetail.tsx
Replace `MultiPhotoCapture` in the Photos card with:
- `PhotoScannerButton` to trigger the camera
- Photo grid showing existing photos (reuse grid styling from current implementation)

### Step 4: Update TaskDetail.tsx
Replace `MultiPhotoCapture` in the Photos card with:
- `PhotoScannerButton` for camera trigger
- Photo grid for display

### Step 5: Update ClaimDetail.tsx
Replace `MultiPhotoCapture` in the Photos tab with:
- `PhotoScannerButton` for camera trigger
- Photo grid for display

### Step 6: Update ItemPhotoGallery.tsx
Replace the current camera input buttons with:
- `PhotoScannerButton` for multi-photo capture
- Keep the existing photo grid with badges, selection, lightbox features

---

## Technical Details

### PhotoScanner Camera Logic (from DocumentScanner)
```text
- Uses navigator.mediaDevices.getUserMedia for live video stream
- Canvas element for capturing frames
- Session-based multi-capture (add/remove photos before saving)
- Fallback to file upload if camera not available
- Environment-facing camera by default
```

### Photo Storage Logic (from MultiPhotoCapture)
```text
- Uploads each photo individually to Supabase 'photos' bucket
- Path format: tenants/{tenant_id}/{entityType}/{entityId}/{timestamp}-{random}.jpg
- Returns array of public URLs
- Supports batch upload with progress indication
```

### Files to Create
1. `src/components/common/PhotoScanner.tsx` - Main camera dialog component
2. `src/components/common/PhotoScannerButton.tsx` - Button trigger component

### Files to Modify
1. `src/pages/ShipmentDetail.tsx` - Replace MultiPhotoCapture
2. `src/pages/TaskDetail.tsx` - Replace MultiPhotoCapture
3. `src/pages/ClaimDetail.tsx` - Replace MultiPhotoCapture
4. `src/components/items/ItemPhotoGallery.tsx` - Replace camera input buttons
5. `src/components/shipments/ReceivingSession.tsx` - Replace MultiPhotoCapture

---

## UI Preview

The new PhotoScanner dialog will look like:
```text
+----------------------------------+
|  [X]    Photos (3)    [Done]     |
+----------------------------------+
|                                  |
|   +------------------------+     |
|   |                        |     |
|   |   Live Camera View     |     |
|   |                        |     |
|   +------------------------+     |
|                                  |
|   [Upload]  ( CAPTURE )  [Done]  |
|                                  |
|   +---+ +---+ +---+ +---+        |
|   |img| |img| |img| | + |  <-- Thumbnail strip
|   | x | | x | | x | |   |
|   +---+ +---+ +---+ +---+        |
+----------------------------------+
```

After clicking Done, all captured photos are uploaded and the callback fires with the new URLs array.
