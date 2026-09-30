import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const registrations = sqliteTable('registrations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex('registrations_name_phone_unique').on(table.name, table.phone)]);

export const loginSessions = sqliteTable('login_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  registrationId: text('registration_id').notNull().references(() => registrations.id),
  expiresAt: integer('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// The 2026 event has five slots. Session and slot must agree in attendance rows.
export const eventSessions = sqliteTable('event_sessions', {
  id: integer('id').primaryKey(),
  slot: integer('slot').notNull(),
  room: text('room').notNull(),
  title: text('title').notNull(),
  startsAt: integer('starts_at').notNull(),
  closesAt: integer('closes_at').notNull(),
}, table => [
  uniqueIndex('event_sessions_id_slot').on(table.id, table.slot),
  uniqueIndex('event_sessions_room_slot').on(table.room, table.slot),
  check('event_sessions_valid_slot', sql`${table.slot} BETWEEN 1 AND 5`),
]);

export const nfcTags = sqliteTable('nfc_tags', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  room: text('room').notNull(),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const attendance = sqliteTable('attendance', {
  registrationId: text('registration_id').notNull().references(() => registrations.id),
  slot: integer('slot').notNull(),
  sessionId: integer('session_id').notNull(),
  tagId: text('tag_id').notNull().references(() => nfcTags.id),
  verifiedAt: integer('verified_at').notNull(),
}, table => [
  primaryKey({ columns: [table.registrationId, table.slot] }),
  foreignKey({ columns: [table.sessionId, table.slot], foreignColumns: [eventSessions.id, eventSessions.slot] }),
]);

export const eventRewards = sqliteTable('event_rewards', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id').notNull().references(() => registrations.id),
  kind: text('kind', { enum: ['gift', 'gift3', 'ticket'] }).notNull(),
  issuedAt: integer('issued_at').notNull(),
  redeemedAt: integer('redeemed_at'),
}, table => [
  uniqueIndex('event_rewards_participant_kind').on(table.registrationId, table.kind),
  check('event_rewards_valid_kind', sql`${table.kind} IN ('gift', 'gift3', 'ticket')`),
]);

export const raffleEntries = sqliteTable('raffle_entries', {
  voidedAt: integer('voided_at'),
  number: integer('number').primaryKey({ autoIncrement: true }),
  registrationId: text('registration_id').notNull().unique().references(() => registrations.id),
  issuedAt: integer('issued_at').notNull(),
});


export const adminSessions = sqliteTable('admin_sessions', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
});
export const adminLoginAttempts = sqliteTable('admin_login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  windowStartedAt: integer('window_started_at').notNull(),
});
export const adminAudit = sqliteTable('admin_audit', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  registrationId: text('registration_id').notNull().references(() => registrations.id),
  action: text('action').notNull(),
  reason: text('reason').notNull(),
  snapshot: text('snapshot').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('admin_audit_registration_created').on(table.registrationId, table.createdAt)]);
