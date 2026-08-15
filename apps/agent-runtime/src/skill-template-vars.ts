import { PROPOSAL_TARGET_FIELDS, SIGNAL_TYPE, SOURCE_TIER, enumCodes } from '@crm/contracts'

/**
 * The values every `{{PLACEHOLDER}}` in a `SKILL.md` is filled from — ONE map, exported so that
 * boot and the tests cannot be looking at different ones.
 *
 * They were two copies until adding a second skill proved why that was a bug: the new skill's
 * `{{SOURCE_TIERS}}` was wired into `main.ts` and the registry test, holding its own list, failed
 * to load the shipped skills directory at all. The failure was loud and harmless that time. The
 * other order — a test that renders a placeholder boot does not, or renders it differently — is the
 * one that matters, because then the prompt the tests vouch for is not the prompt the model gets.
 *
 * `skill-registry.ts` explains why these come from `@crm/contracts` rather than being typed into
 * the markdown: a prompt offering the model an enum value the database rejects produces answers
 * that parse and then vanish, with nothing erroring on the way.
 */
export const SKILL_TEMPLATE_VARS: Record<string, string> = {
  PROPOSAL_TARGET_FIELDS: PROPOSAL_TARGET_FIELDS.join(' | '),
  SIGNAL_TYPES: enumCodes(SIGNAL_TYPE).join(' | '),
  SOURCE_TIERS: enumCodes(SOURCE_TIER).join(' | '),
}
