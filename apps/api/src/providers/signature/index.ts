import { env } from "../../env.js";
import { MockSignatureProvider } from "./MockSignatureProvider.js";
import type { SignatureProvider } from "./SignatureProvider.js";

// Provider selection is centralized here so a future ICP-Brasil integration
// (Assinafy, Clicksign, ...) is a one-file change: implement SignatureProvider
// and switch on env.signatureProvider.
export function getSignatureProvider(): SignatureProvider {
  switch (env.signatureProvider) {
    case "mock":
    default:
      return new MockSignatureProvider();
  }
}

export type { SignatureProvider, SignRequest, SignResult } from "./SignatureProvider.js";
