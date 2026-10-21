import { createRequire } from "node:module";
import type { MomentFactory } from "../src/lists/vault.ts";

export const moment: MomentFactory = createRequire(import.meta.url)("moment");
