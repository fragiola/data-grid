import { examplesE2eConfig } from "examples-shared/e2e/config";

// The shared suite (examples/shared/e2e) against this app's embed: a production build under
// /data-grid/embed/react/, served with a host page that embeds it in an iframe, in Chromium,
// Firefox and WebKit. The build uses the packages' `dist`: build them first (`pnpm build` at the
// root does).
export default examplesE2eConfig("react");
