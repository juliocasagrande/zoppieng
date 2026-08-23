export interface SignRequest {
  reportId: string;
  engineerId: string;
  engineerName: string;
  engineerCrea: string | null;
  documentBuffer: Buffer;
}

export interface SignResult {
  provider: string;
  providerReference: string | null;
  documentHash: string;
  signedAt: string;
}

// Abstraction over whichever ICP-Brasil signature provider is chosen later
// (Assinafy, Clicksign, a custom PAdES library, ...). The review flow only
// depends on this interface, so swapping providers never touches the review
// endpoints — only providers/signature/index.ts changes.
export interface SignatureProvider {
  sign(request: SignRequest): Promise<SignResult>;
}
