import crypto from "node:crypto";
import type { SignatureProvider, SignRequest, SignResult } from "./SignatureProvider.js";

// Simulates a signed document: computes a hash of the PDF and records a fake
// provider reference. Good enough to exercise the full review → PDF →
// delivery flow before a real ICP-Brasil provider is contracted.
export class MockSignatureProvider implements SignatureProvider {
  async sign(request: SignRequest): Promise<SignResult> {
    const documentHash = crypto.createHash("sha256").update(request.documentBuffer).digest("hex");
    return {
      provider: "mock",
      providerReference: `mock-sig-${crypto.randomUUID()}`,
      documentHash,
      signedAt: new Date().toISOString(),
    };
  }
}
