import type ts from "typescript/lib/tsserverlibrary";

import fs from "fs";
import { getAdditionalInlays } from "./getAdditionalInlays.cjs";

fs.writeFileSync("/tmp/tsslog", `Hello, ${new Date()}`);

export = tsServerPluginInit;

function tsServerPluginInit(modules: {
  typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
  const { typescript } = modules;

  return { create };

  function create(info: ts.server.PluginCreateInfo) {
    const proxy: ts.LanguageService = Object.create(null);
    for (const k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      const x = info.languageService[k];
      proxy[k] = x as any;
    }

    const originalProvideInlayHints = proxy.provideInlayHints;
    proxy.provideInlayHints = (fileName, span, preferences) => {
      // span is range of all those source code for which inlay hints are requested
      const originalResult = originalProvideInlayHints(
        fileName,
        span,
        preferences
      );

      const sf = info.project.getSourceFile(
        info.project.projectService.toPath(fileName)
      );
      if (sf === undefined) {
        return originalResult;
      }
      const inlays = getAdditionalInlays(typescript, sf, span);
      return originalResult.concat(inlays);
    };

    return proxy;
  }
}
