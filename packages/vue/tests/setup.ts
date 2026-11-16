import "@testing-library/jest-dom/vitest";
import { enableAutoUnmount } from "@vue/test-utils";
import { afterEach } from "vitest";

// every wrapper mounted by a test unmounts after it, as Testing Library's cleanup does
enableAutoUnmount(afterEach);
afterEach(() => {
    document.body.innerHTML = "";
});
