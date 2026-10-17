// Generates the typed program client from the Anchor IDL.
// Run after `anchor build --arch v0` in program/: npm run generate:client
import { readFileSync } from "node:fs";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { createFromRoot } from "codama";

const idl = JSON.parse(readFileSync(new URL("../../program/target/idl/accrue.json", import.meta.url)));

createFromRoot(rootNodeFromAnchor(idl)).accept(
  renderVisitor(".", { generatedFolder: "lib/accrue/generated", syncPackageJson: false }),
);
