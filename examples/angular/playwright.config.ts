import { examplesE2eConfig } from "examples-shared/e2e/config";

// The shared suite (examples/shared/e2e) against this app's embed: a production build under
// /data-grid/embed/angular/, served with a host page that embeds it in an iframe, in Chromium,
// Firefox and WebKit. A spec whose example this app does not have yet is skipped (e2e/available.ts).
// The build uses the packages' `dist`: build them first (`pnpm build` at the root does).
export default examplesE2eConfig("angular");
