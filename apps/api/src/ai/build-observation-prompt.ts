import { PROPOSAL_TARGET_FIELDS, type ObservationInput } from '@crm/contracts'

/**
 * The user turn handed to whichever adapter is behind `CLAIM_EXTRACTOR`.
 *
 * Shared for the same reason `parse-claim-drafts.ts` is: the SDK adapter and the CLI adapter
 * must ask the same question, or a demo run through one will produce findings a demo run
 * through the other does not — and the difference would look like model variance rather than
 * like two prompts that drifted apart.
 *
 * `companyType` is in here because a finding is read under the lens of the company type
 * (ontology section 4): "hiring 200 engineers" means one thing for an IT outsourcing prospect
 * and another for a traditional manufacturer.
 *
 * The four current profile values are included so the model only suggests a field that is
 * blank or stale (ADR-0024). It is a HINT, not a guarantee — code compares against the profile
 * again before a proposal is created.
 */
export function buildObservationPrompt(observation: ObservationInput): string {
  return [
    `Loại hình công ty: ${observation.companyType}`,
    `Ngữ cảnh sinh phát hiện: ${observation.triggerContext}`,
    '',
    'Giá trị hiện tại của bốn ô hồ sơ (dùng để biết ô nào trống hoặc đã cũ):',
    ...PROPOSAL_TARGET_FIELDS.map(
      (field) => `- ${field}: ${observation.currentProfile[field] ?? '(trống)'}`,
    ),
    '',
    'Nội dung bản chụp:',
    observation.rawContent,
  ].join('\n')
}
