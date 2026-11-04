/**
 * Read-only SQL behind the Leads Command Center. No parameters, no writes.
 *
 * Days are worked out HERE, not in JavaScript. Morocco moved to plain GMT on
 * 2026-09-20; Postgres has that rule, but Node's bundled time zone data can lag
 * behind it, so `Intl` may be an hour out. `(ts AT TIME ZONE 'UTC') AT TIME ZONE
 * 'Africa/Casablanca'` is needed because these columns are UTC with no zone.
 */

/** "Today" in Marrakech, as YYYY-MM-DD. */
export const LEAD_QUEUE_CLOCK_SQL = `
SELECT to_char(now() AT TIME ZONE 'Africa/Casablanca', 'YYYY-MM-DD') AS "today"`;

/** Marrakech day of a stored timestamp, as YYYY-MM-DD. */
const day = (column: string) =>
  `to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Casablanca', 'YYYY-MM-DD')`;

/**
 * Every open prospect that could need action, with the facts the rules need.
 * A confirmed send is an outreach_messages row from 2026-08-20 on, when the
 * "did you actually send it?" step shipped. Older rows and SENT_* activities can
 * mean only that a button was clicked.
 */
export const LEAD_QUEUE_PROSPECTS_SQL = `
WITH confirmed AS (
  SELECT DISTINCT ON (prospect_id) prospect_id, sent_at, channel
    FROM outreach_messages
   WHERE sent_at >= timestamp '2026-08-20'
   ORDER BY prospect_id, sent_at DESC
),
last_reply AS (
  SELECT DISTINCT ON (prospect_id) prospect_id, reply_reason, replied_at
    FROM outreach_messages
   WHERE replied
   ORDER BY prospect_id, replied_at DESC NULLS LAST
)
SELECT
  p.id, p.name, p.sector, p.neighborhood, p.phone, p.instagram, p.status,
  p.whatsapp_link     AS "whatsappLink",
  p.whatsapp_status   AS "whatsappStatus",
  p.instagram_status  AS "instagramStatus",
  p.quality_label     AS "qualityLabel",
  p.score             AS "score",
  (p.sent_at IS NOT NULL) AS "hasSentAt",
  (p.followup_1_at IS NOT NULL) AS "followup1Done",
  (p.followup_2_at IS NOT NULL) AS "followup2Done",
  (p.followup_3_at IS NOT NULL) AS "followup3Done",
  ${day("p.created_at")}     AS "createdDay",
  ${day("p.follow_up_date")} AS "followUpDay",
  ${day("c.sent_at")}        AS "lastSendDay",
  c.channel                  AS "lastSendChannel",
  r.reply_reason             AS "replyReason",
  ${day("r.replied_at")}     AS "repliedDay",
  (r.prospect_id IS NOT NULL) AS "messageReplied",
  EXISTS (SELECT 1 FROM outreach_messages m WHERE m.prospect_id = p.id) AS "anyMessage",
  EXISTS (SELECT 1 FROM prospect_activities a WHERE a.prospect_id = p.id
           AND a.action_type IN ('SENT_WHATSAPP','SENT_INSTAGRAM')) AS "anySendActivity",
  EXISTS (SELECT 1 FROM prospect_activities a WHERE a.prospect_id = p.id
           AND a.previous_status = 'REPONDU' AND a.new_status = 'ENVOYE') AS "replyWasReset",
  EXISTS (SELECT 1 FROM prospect_activities a WHERE a.prospect_id = p.id
           AND a.action_type = 'REPLY_REVIEWED') AS "replyReviewed",
  EXISTS (SELECT 1 FROM prospect_activities a WHERE a.prospect_id = p.id
           AND a.action_type = 'NO_MORE_FOLLOW_UP'
           AND (c.sent_at IS NULL OR a.created_at >= c.sent_at)) AS "followUpStopped",
  EXISTS (SELECT 1 FROM meetings mt WHERE mt.prospect_id = p.id AND mt.status <> 'CANCELLED') AS "liveMeeting",
  EXISTS (SELECT 1 FROM proposals pr WHERE pr.prospect_id = p.id) AS "hasProposal"
FROM prospects p
LEFT JOIN confirmed c ON c.prospect_id = p.id
LEFT JOIN last_reply r ON r.prospect_id = p.id
WHERE p.status NOT IN ('CONVERTI','CLIENT','LOST','PERDU','REFUSE')
  AND (
    p.status IN ('REPONDU','A_ENVOYER')
    OR p.follow_up_date IS NOT NULL
    OR c.prospect_id IS NOT NULL
    OR r.prospect_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM prospect_activities a WHERE a.prospect_id = p.id AND a.previous_status = 'REPONDU')
  )`;

/** Website enquiries still marked NEW. TEST enquiries are excluded by the status itself. */
export const LEAD_QUEUE_ENQUIRIES_SQL = `
SELECT
  l.id, l.full_name AS "fullName", l.email, l.phone, l.subject,
  left(l.message, 240) AS "message",
  ${day("l.created_at")} AS "createdDay",
  EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(l.email)) AS "fromTeamEmail"
FROM leads l
WHERE l.status = 'NEW'`;
