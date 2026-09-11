import { pgTable, text, integer, real, timestamp, jsonb, serial, varchar } from "drizzle-orm/pg-core";

export const highScores = pgTable("high_scores", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 24 }).notNull().default("ACE"),
  mode: varchar("mode", { length: 32 }).notNull(),
  score: integer("score").notNull().default(0),
  kills: integer("kills").notNull().default(0),
  wave: integer("wave").notNull().default(0),
  accuracy: real("accuracy").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const parties = pgTable("parties", {
  code: varchar("code", { length: 6 }).primaryKey(),
  hostName: varchar("host_name", { length: 24 }).notNull(),
  hostId: varchar("host_id", { length: 64 }).notNull(),
  mode: varchar("mode", { length: 32 }).notNull().default("SKIRMISH"),
  arena: varchar("arena", { length: 32 }).notNull().default("NEON_VOID"),
  status: varchar("status", { length: 16 }).notNull().default("lobby"), // lobby | playing | ended
  maxPlayers: integer("max_players").notNull().default(6),
  killTarget: integer("kill_target").notNull().default(10),
  timeLimit: integer("time_limit").notNull().default(300),
  startedAt: timestamp("started_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const partyPlayers = pgTable("party_players", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 6 }).notNull(),
  playerId: varchar("player_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 24 }).notNull(),
  skin: varchar("skin", { length: 32 }).notNull().default("cyan"),
  weapon: varchar("weapon", { length: 32 }).notNull().default("rifle"),
  posX: real("pos_x").notNull().default(0),
  posY: real("pos_y").notNull().default(1.7),
  posZ: real("pos_z").notNull().default(0),
  rotY: real("rot_y").notNull().default(0),
  pitch: real("pitch").notNull().default(0),
  health: integer("health").notNull().default(100),
  maxHealth: integer("max_health").notNull().default(100),
  score: integer("score").notNull().default(0),
  kills: integer("kills").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  alive: integer("alive").notNull().default(1),
  lastShotAt: timestamp("last_shot_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partyEvents = pgTable("party_events", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 6 }).notNull(),
  fromId: varchar("from_id", { length: 64 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(), // damage | kill | chat | ping | start | end
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});
