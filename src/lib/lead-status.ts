/**
 * Website-enquiry (Lead) statuses.
 *
 * TEST marks an enquiry the team sent itself (an internal test of the contact
 * form). It lives in the existing free-text `leads.status` column, so no
 * migration is needed. Nothing sets it automatically: a person chooses
 * "Internal test" on the enquiry page, one enquiry at a time, and can change
 * it back. Every "new enquiries" count selects status NEW, so a TEST enquiry
 * drops out of the action counts without being deleted or hidden.
 */

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED", "TEST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TEST_STATUS: LeadStatus = "TEST";

/** The four working stages shown as board columns. TEST is kept off the board. */
export const LEAD_BOARD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"] as const;

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
  TEST: "Internal test",
};

export function leadStatusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status as LeadStatus] ?? status;
}
