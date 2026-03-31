import { Pool, PoolClient } from "pg";

// ---------------------------------------------------------------------------
// Singleton pool – reused across hot-reloads in dev
// ---------------------------------------------------------------------------
const globalForPg = globalThis as unknown as { pgPool?: Pool };

function getPool(): Pool {
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      ssl: process.env.DATABASE_URL?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return globalForPg.pgPool;
}

// ---------------------------------------------------------------------------
// ChatStore – mirrors Testing-Website/chat_store.py
// ---------------------------------------------------------------------------
export class ChatStore {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  // ------ helpers ------
  private async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  // ------ schema ------
  async ensureSchema(): Promise<void> {
    await this.withClient(async (c) => {
      await c.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await c.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ended_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          end_trigger TEXT
        );
      `);
      await c.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS prompt_snapshot JSONB;
      `);
      await c.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id BIGSERIAL PRIMARY KEY,
          conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          position INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (conversation_id, position)
        );
      `);
    });
  }

  // ------ users ------
  async upsertUser(name: string): Promise<number> {
    return this.withClient(async (c) => {
      const res = await c.query(
        `INSERT INTO users (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id;`,
        [name.trim()]
      );
      return Number(res.rows[0].id);
    });
  }

  // ------ conversations ------
  async createConversation(
    userName: string,
    promptSnapshot?: Record<string, unknown>
  ): Promise<number> {
    const userId = await this.upsertUser(userName);
    const snapshotJson = promptSnapshot ? JSON.stringify(promptSnapshot) : null;
    return this.withClient(async (c) => {
      const res = await c.query(
        `INSERT INTO conversations (user_id, status, prompt_snapshot)
         VALUES ($1, 'active', $2::jsonb)
         RETURNING id;`,
        [userId, snapshotJson]
      );
      return Number(res.rows[0].id);
    });
  }

  async appendMessage(
    conversationId: number,
    role: string,
    content: string
  ): Promise<void> {
    await this.withClient(async (c) => {
      await c.query(
        `INSERT INTO messages (conversation_id, role, content, position)
         VALUES (
           $1, $2, $3,
           COALESCE(
             (SELECT MAX(position) + 1 FROM messages WHERE conversation_id = $1),
             0
           )
         );`,
        [conversationId, role, content]
      );
      await c.query(
        `UPDATE conversations SET updated_at = NOW() WHERE id = $1;`,
        [conversationId]
      );
    });
  }

  async hasUserMessages(conversationId: number): Promise<boolean> {
    return this.withClient(async (c) => {
      const res = await c.query(
        `SELECT 1 FROM messages
         WHERE conversation_id = $1 AND role = 'user'
         LIMIT 1;`,
        [conversationId]
      );
      return res.rowCount !== null && res.rowCount > 0;
    });
  }

  async deriveTitle(conversationId: number): Promise<string> {
    return this.withClient(async (c) => {
      const res = await c.query(
        `SELECT content FROM messages
         WHERE conversation_id = $1 AND role = 'user'
         ORDER BY position ASC
         LIMIT 1;`,
        [conversationId]
      );
      if (res.rows.length === 0) return "New chat";
      const first = res.rows[0].content.split(/\s+/).join(" ").trim();
      if (!first) return "New chat";
      return first.length <= 60 ? first : first.slice(0, 57).trimEnd() + "...";
    });
  }

  async deleteConversation(conversationId: number): Promise<void> {
    await this.withClient(async (c) => {
      await c.query(`DELETE FROM conversations WHERE id = $1;`, [conversationId]);
    });
  }

  async endConversation(
    conversationId: number,
    endTrigger: string,
    title?: string,
    discardIfEmpty = true
  ): Promise<boolean> {
    const hasUser = await this.hasUserMessages(conversationId);
    if (discardIfEmpty && !hasUser) {
      await this.deleteConversation(conversationId);
      return false;
    }
    const finalTitle = title || (await this.deriveTitle(conversationId));
    await this.withClient(async (c) => {
      await c.query(
        `UPDATE conversations
         SET status = 'ended',
             ended_at = NOW(),
             updated_at = NOW(),
             end_trigger = $1,
             title = COALESCE(NULLIF($2, ''), title, 'New chat')
         WHERE id = $3;`,
        [endTrigger, finalTitle, conversationId]
      );
    });
    return true;
  }

  async finalizeStaleConversations(
    userName: string,
    staleMinutes = 120
  ): Promise<number> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    const rows = await this.withClient(async (c) => {
      const res = await c.query(
        `SELECT c.id
         FROM conversations c
         JOIN users u ON u.id = c.user_id
         WHERE u.name = $1
           AND c.status = 'active'
           AND c.updated_at < $2;`,
        [userName.trim(), cutoff]
      );
      return res.rows;
    });

    let finalized = 0;
    for (const row of rows) {
      const kept = await this.endConversation(Number(row.id), "stale_timeout");
      if (kept) finalized++;
    }
    return finalized;
  }

  async listConversations(
    userName: string,
    limit = 100
  ): Promise<
    {
      id: number;
      title: string;
      started_at: string;
      ended_at: string | null;
      user_name: string;
      prompt_snapshot: Record<string, unknown> | null;
    }[]
  > {
    return this.withClient(async (c) => {
      const res = await c.query(
        `SELECT
           c.id,
           COALESCE(NULLIF(c.title, ''), 'New chat') AS title,
           c.started_at,
           c.ended_at,
           u.name AS user_name,
           c.prompt_snapshot
         FROM conversations c
         JOIN users u ON u.id = c.user_id
         WHERE u.name = $1
           AND EXISTS (
             SELECT 1 FROM messages m
             WHERE m.conversation_id = c.id AND m.role = 'user'
           )
         ORDER BY COALESCE(c.ended_at, c.started_at) DESC
         LIMIT $2;`,
        [userName.trim(), limit]
      );
      return res.rows.map((r) => ({
        id: Number(r.id),
        title: r.title,
        started_at: r.started_at,
        ended_at: r.ended_at,
        user_name: r.user_name,
        prompt_snapshot: r.prompt_snapshot || null,
      }));
    });
  }

  async getMessages(
    conversationId: number
  ): Promise<{ role: string; content: string; position: number; created_at: string }[]> {
    return this.withClient(async (c) => {
      const res = await c.query(
        `SELECT role, content, position, created_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY position ASC;`,
        [conversationId]
      );
      return res.rows.map((r) => ({
        role: r.role,
        content: r.content,
        position: r.position,
        created_at: r.created_at,
      }));
    });
  }
}

// Singleton instance
export const chatStore = new ChatStore();
