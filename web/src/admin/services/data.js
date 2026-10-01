import { getAdminClient } from '../../lib/supabase-admin-client.js';
import { itemHasPlaceholderMedia, summarizePlaceholders } from '../../lib/placeholders.js';
import { unwrap } from './errors.js';

/**
 * All database access for the admin lives here. Every call runs as the signed-in
 * owner, so Row Level Security (not this code) decides what is allowed.
 * Errors are thrown as friendly AppErrors (see errors.js).
 */

const db = () => getAdminClient();

// ---------------------------------------------------------------------------
// Settings (one row)
// ---------------------------------------------------------------------------

export async function getSettings() {
  const row = unwrap(await db().from('site_settings').select('*').limit(1).maybeSingle(), 'Could not load your settings.');
  if (!row) throw new Error('Your settings row is missing. Ask your developer to run the owner bootstrap (see README).');
  return row;
}

/** @param {string} ownerId @param {Record<string, any>} patch */
export async function updateSettings(ownerId, patch) {
  return unwrap(await db().from('site_settings').update(patch).eq('owner_id', ownerId).select('*').single(), 'Could not save your changes.');
}

// ---------------------------------------------------------------------------
// Generic ordered lists: reviews, FAQs, services, categories
// ---------------------------------------------------------------------------

/**
 * Persist a new order atomically through the invoker-rights RPC.
 * @param {'gallery_items'|'gallery_categories'|'gallery_media'|'reviews'|'faqs'|'services'} kind
 * @param {string[]} ids in their new display order
 */
export async function saveOrder(kind, ids) {
  unwrap(await db().rpc('reorder_content', { p_kind: kind, p_ids: ids }), 'Could not save the new order.');
}

function listApi(table, { orderBy = 'sort_order', select = '*' } = {}) {
  return {
    async list({ includeArchived = true } = {}) {
      let q = db().from(table).select(select).order(orderBy, { ascending: true }).order('created_at', { ascending: true });
      if (!includeArchived) q = q.is('archived_at', null);
      return unwrap(await q, 'Could not load the list.');
    },
    async create(values) {
      return unwrap(await db().from(table).insert(values).select('*').single(), 'Could not add that.');
    },
    async update(id, patch) {
      return unwrap(await db().from(table).update(patch).eq('id', id).select('*').single(), 'Could not save your changes.');
    },
    async remove(id) {
      unwrap(await db().from(table).delete().eq('id', id), 'Could not delete that.');
    },
  };
}

export const reviewsApi = listApi('reviews');
export const faqsApi = listApi('faqs');
export const servicesApi = listApi('services');
export const categoriesApi = listApi('gallery_categories');

/** Next sort position for a table: one past the current maximum. */
export async function nextSortOrder(table) {
  const { data } = await db().from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1);
  return (data?.[0]?.sort_order ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

const ITEM_SELECT =
  '*, category:gallery_categories(id,name,slug), media:gallery_media(id,item_id,media_type,role,storage_path,card_path,poster_path,width,height,duration_seconds,mime_type,byte_size,sort_order)';

export const itemsApi = {
  /** @param {{ categoryId?: string, status?: 'all'|'published'|'draft'|'archived'|'placeholder' }} [filters] */
  async list({ categoryId, status = 'all' } = {}) {
    let q = db().from('gallery_items').select(ITEM_SELECT).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (categoryId) q = q.eq('category_id', categoryId);
    if (status === 'published') q = q.eq('is_published', true).is('archived_at', null);
    if (status === 'draft') q = q.eq('is_published', false).is('archived_at', null);
    if (status === 'archived') q = q.not('archived_at', 'is', null);
    if (status === 'all' || status === 'placeholder') q = q.is('archived_at', null);
    const rows = unwrap(await q, 'Could not load your portfolio.');
    // "Placeholder" = still using a starter photo (see lib/placeholders.js).
    return status === 'placeholder' ? rows.filter(itemHasPlaceholderMedia) : rows;
  },
  async get(id) {
    const row = unwrap(await db().from('gallery_items').select(ITEM_SELECT).eq('id', id).maybeSingle(), 'Could not load that item.');
    if (!row) throw Object.assign(new Error('That portfolio item no longer exists. It may have been deleted.'), { notFound: { href: '/admin/portfolio', label: 'Back to Manage Work' } });
    return row;
  },
  async create(values) {
    return unwrap(await db().from('gallery_items').insert(values).select('id').single(), 'Could not create the portfolio item.');
  },
  async update(id, patch) {
    return unwrap(await db().from('gallery_items').update(patch).eq('id', id).select('*').single(), 'Could not save your changes.');
  },
  /** Archive = hide from the public site but keep everything, so it can be restored. */
  async archive(id) {
    return this.update(id, { is_published: false, archived_at: new Date().toISOString() });
  },
  async restore(id) {
    return this.update(id, { archived_at: null });
  },
  async remove(id) {
    unwrap(await db().from('gallery_items').delete().eq('id', id), 'Could not delete that item.');
  },
};

export const mediaApi = {
  async insert(values) {
    return unwrap(await db().from('gallery_media').insert(values).select('*').single(), 'Could not save the media.');
  },
  async update(id, patch) {
    return unwrap(await db().from('gallery_media').update(patch).eq('id', id).select('*').single(), 'Could not save the media.');
  },
  async remove(id) {
    unwrap(await db().from('gallery_media').delete().eq('id', id), 'Could not remove the media.');
  },
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function count(table, apply) {
  let q = db().from(table).select('id', { count: 'exact', head: true });
  q = apply ? apply(q) : q;
  const { count: n, error } = await q;
  return error ? null : n;
}

export async function getDashboardCounts() {
  const [published, drafts, archived, reviews, faqs, newRequests] = await Promise.all([
    count('gallery_items', (q) => q.eq('is_published', true).is('archived_at', null)),
    count('gallery_items', (q) => q.eq('is_published', false).is('archived_at', null)),
    count('gallery_items', (q) => q.not('archived_at', 'is', null)),
    count('reviews', (q) => q.eq('is_published', true).is('archived_at', null)),
    count('faqs', (q) => q.eq('is_published', true).is('archived_at', null)),
    count('appointment_requests', (q) => q.eq('status', 'new')),
  ]);
  return { published, drafts, archived, reviews, faqs, newRequests };
}

export async function getRecentActivity(limit = 8) {
  return unwrap(await db().from('admin_audit_log').select('id,action,entity_type,metadata,created_at').order('created_at', { ascending: false }).limit(limit), 'Could not load recent activity.');
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

/** How many portfolio items (any status) point at this category. */
export async function countItemsInCategory(categoryId) {
  const { count: n, error } = await db().from('gallery_items').select('id', { count: 'exact', head: true }).eq('category_id', categoryId);
  if (error) unwrap({ error }, 'Could not check the category.');
  return n ?? 0;
}

/** Move every item from one category to another (or to none). */
export async function reassignCategory(fromId, toId) {
  unwrap(await db().from('gallery_items').update({ category_id: toId }).eq('category_id', fromId), 'Could not move the items.');
}

// ---------------------------------------------------------------------------
// Placeholder tracking (see lib/placeholders.js for how it is detected)
// ---------------------------------------------------------------------------

/** What is still starter/placeholder content, for the dashboard. */
export async function getPlaceholderSummary(settings) {
  const [media, reviews, faqs] = await Promise.all([
    db().from('gallery_media').select('item_id,storage_path').like('storage_path', '%-starter.%'),
    db().from('reviews').select('id,quote').is('archived_at', null).ilike('quote', '[placeholder review]%'),
    db().from('faqs').select('id,answer').is('archived_at', null).ilike('answer', '[owner to review%'),
  ]);
  const byItem = new Map();
  for (const m of media.data ?? []) byItem.set(m.item_id, { media: [{ storage_path: m.storage_path }] });
  return summarizePlaceholders({ items: [...byItem.values()], reviews: reviews.data ?? [], faqs: faqs.data ?? [], settings });
}

// ---------------------------------------------------------------------------
// Appointment requests (the booking-form inbox). Personal data: owner-only by RLS.
// ---------------------------------------------------------------------------

const REQUEST_SELECT = 'id,full_name,phone,email,service,client_type,preferred_date,preferred_time_slot,notes,status,created_at';

export const requestsApi = {
  /** @param {{ status?: 'open'|'all'|'new'|'contacted'|'booked'|'closed' }} [filter] open = everything not closed */
  async list({ status = 'open' } = {}) {
    let q = db().from('appointment_requests').select(REQUEST_SELECT).order('created_at', { ascending: false }).limit(200);
    if (status === 'open') q = q.neq('status', 'closed');
    else if (status !== 'all') q = q.eq('status', status);
    return unwrap(await q, 'Could not load your requests.');
  },
  async setStatus(id, status) {
    return unwrap(await db().from('appointment_requests').update({ status }).eq('id', id).select(REQUEST_SELECT).single(), 'Could not update that request.');
  },
  async remove(id) {
    unwrap(await db().from('appointment_requests').delete().eq('id', id), 'Could not delete that request.');
  },
};
