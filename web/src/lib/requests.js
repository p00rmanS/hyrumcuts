/**
 * Appointment requests from the booking form. Pure helpers (no DOM, no
 * network) so the shaping and wording are unit-tested; the limits mirror
 * supabase/migrations/*_appointment_requests.sql, which has the final say.
 */

export const REQUEST_STATUSES = Object.freeze([
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'booked', label: 'Booked' },
  { value: 'closed', label: 'Closed' },
]);

export const CLIENT_TYPE_LABELS = Object.freeze({ first_time: 'First-time client', returning: 'Returning client' });

const clip = (v, max) => String(v ?? '').trim().slice(0, max);

/**
 * Form fields -> the row a visitor is allowed to insert. Only the columns the
 * database grants to visitors; never owner_id or status.
 * @param {Record<string, unknown>} f plain object of form values
 */
export function buildRequestRow(f) {
  return {
    full_name: clip(f.full_name, 120),
    phone: clip(f.phone, 30),
    email: clip(f.email, 190),
    service: clip(f.service, 80),
    client_type: f.client_type === 'returning' ? 'returning' : 'first_time',
    preferred_date: clip(f.preferred_date, 10),
    preferred_time_slot: clip(f.preferred_time_slot, 60),
    notes: clip(f.notes, 1000),
    consent: f.consent === true || f.consent === '1' || f.consent === 'on',
  };
}

/** A spam bot filled the hidden field: pretend it worked and send nothing. */
export function isBot(f) {
  return String(f['bot-field'] ?? '').trim() !== '';
}

/** Turn a database / network error into one calm sentence for the visitor. */
export function requestErrorMessage(error) {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`;
  if (/too many requests/i.test(text)) return 'A lot of requests are coming in right now. Please try again in a few minutes.';
  if (/not set up to take requests/i.test(text)) return "Online requests aren't switched on yet. Please use the contact details at the bottom of the page.";
  if (/contact_format|phone/i.test(text)) return 'Please check your phone number and email address and try again.';
  if (/date_range/i.test(text)) return 'Please pick a date from the calendar.';
  if (/fetch|network|failed to fetch|abort|timeout/i.test(text)) return "Your request couldn't be sent. Check your connection and try again. Nothing you typed has been lost.";
  return "Your request couldn't be sent. Please try again, or use the contact details at the bottom of the page.";
}

/** "2030-01-15" -> "Tue, Jan 15, 2030" without shifting the calendar date. */
export function formatRequestDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso ?? '');
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Count of requests nobody has looked at yet. */
export function countNew(rows) {
  return (rows ?? []).filter((r) => r.status === 'new').length;
}
