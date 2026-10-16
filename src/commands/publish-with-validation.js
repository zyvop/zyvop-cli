import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { validateAiDisclosureForStatus } from "../ai-disclosure.js";
import { buildPublishPayload } from "../publish-payload.js";
import { publishCommand } from "./publish.js";

export async function publishWithValidation(filePath, options) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(resolvedPath)) {
    try {
      const rawFile = fs.readFileSync(resolvedPath, "utf-8");
      const payload = buildPublishPayload({ filePath, rawFile, options });
      validateAiDisclosureForStatus(payload);
    } catch (error) {
      console.log(pc.red(`\nError: ${error.message}\n`));
      process.exitCode = 1;
      return;
    }
  }

  await publishCommand(filePath, options);
}
