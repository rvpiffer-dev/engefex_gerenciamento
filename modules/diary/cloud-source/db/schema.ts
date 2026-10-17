import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', { id:text('id').primaryKey(), owner:text('owner').notNull(), kind:text('kind').notNull(), body:text('body').notNull(), revision:integer('revision').notNull().default(1), updated:text('updated').notNull() });
export const photos = sqliteTable('photos', { id:text('id').primaryKey(), owner:text('owner').notNull(), mime:text('mime').notNull(), size:integer('size').notNull() });
