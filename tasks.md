# Cephlow2 Architectural Upgrade Tasks

## H1: Task Queue Infrastructure (Foundation)
- [ ] **L1.1: Database Schema**
    - [x] Run SQL for `tasks` table in Supabase
    - [x] Verify table existence and indices
- [ ] **L1.2: Database Package Update**
    - [x] Add `Task` interface to `@workspace/supabase`
    - [ ] Update `toCamel`/`toSnake` to handle `tasks` table (Already done in previous step)
- [ ] **L1.3: Producer Logic (Refactoring API)**
    - [x] Refactor `POST /generate` to insert rows into `tasks`
    - [x] Implement batched task insertion for 1,000+ rows
    - [x] Stop the brittle "fire-and-forget" async IIFE loop

## H2: The Rendering Engine (The Engine)
- [ ] **L2.1: Template Sync Service**
    - [ ] Create `lib/renderer.ts`
    - [ ] Implement one-time Template Fetcher (Slide structure + Background PNG)
- [ ] **L2.2: Local Composition Logic**
    - [ ] Implement HTML/SVG rendering using `Satori`
    - [ ] Port EMU-based font-scaling logic from `googleDrive.ts`
    - [ ] Add local QR code generation and overlay
- [ ] **L2.3: Storage Pipeline**
    - [ ] Implement direct-to-R2 streaming upload
    - [ ] Ensure PDF buffers are cleared from memory immediately after upload

## H3: Background Worker (Reliability)
- [ ] **L3.1: Task Processor Loop**
    - [ ] Implement `FOR UPDATE SKIP LOCKED` polling logic
    - [ ] Handle task retries and error logging
- [ ] **L3.2: Progress Synchronization**
    - [ ] Implement batched updates for `batches.generatedCount`
    - [ ] Refactor UI polling API to read from `tasks` table

## H4: Integration & Polish
- [ ] **L4.1: Optional Drive Sync**
    - [ ] Implement `POST /batches/:id/sync-drive` for manual backup
    - [ ] Add background task for Drive sync
- [ ] **L4.2: UI/UX Enhancements**
    - [ ] Add "Sync to Drive" button to frontend
    - [ ] Update progress bar to show task-specific errors
- [ ] **L4.3: Final Verification**
    - [ ] Performance benchmark (R2 vs old Drive method)
    - [ ] Visual fidelity audit (Slide vs Local PDF)
