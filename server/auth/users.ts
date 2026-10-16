/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 *
 * Local user accounts. Reuses the same generic, validated JSON-file
 * repository factory (../domain/store.ts) every one of the 33 domain
 * entities already uses — kept in server/auth/ rather than
 * server/domain/entities/ since an application user is a different concern
 * from a deal/fund domain object, but the storage pattern is identical.
 */
import { z } from "zod";
import { withMeta } from "../domain/common";
import { createEntityStore } from "../domain/store";

export const ROLES = ["partner", "principal", "associate", "analyst", "compliance", "ops"] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const UserSchema = withMeta({
  name: z.string().min(1),
  email: z.string().email(),
  /** "saltHex:hashHex" — see ./passwords.ts. Never sent to the client. */
  passwordHash: z.string(),
  role: Role,
  active: z.boolean().default(true),
});
export type User = z.infer<typeof UserSchema>;

export const users = createEntityStore("User", "users.json", UserSchema);

export function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return users.list().find((u) => u.email.toLowerCase() === normalized) ?? null;
}

/** Never send passwordHash to a client — every route response goes through this first. */
export function publicUser(user: NonNullable<ReturnType<typeof users.get>>) {
  const { passwordHash, ...rest } = user;
  return rest;
}
