use chrono::{DateTime, Utc};
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Chat {
    pub id: String,
    pub title: String,
    pub model: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub role: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;

        // Enable foreign key support
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Create tables if they don't exist
        conn.execute(
            "CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
            )",
            [],
        )?;

        Ok(Database { conn })
    }

    // Modified to take &mut self
    pub fn delete_chat(&mut self, chat_id: &str) -> Result<()> {
        // Delete messages first (due to foreign key constraint)
        self.conn
            .execute("DELETE FROM messages WHERE chat_id = ?1", [chat_id])?;

        // Delete the chat
        self.conn
            .execute("DELETE FROM chats WHERE id = ?1", [chat_id])?;

        Ok(())
    }

    // Other methods should also be updated to &mut self if they modify the database
    pub fn add_message(&mut self, chat_id: &str, role: &str, content: &str) -> Result<Message> {
        let message = Message {
            id: Uuid::new_v4().to_string(),
            chat_id: chat_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            created_at: Utc::now(),
        };

        self.conn.execute(
            "INSERT INTO messages (id, chat_id, role, content, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &message.id,
                &message.chat_id,
                &message.role,
                &message.content,
                &message.created_at.to_rfc3339(),
            ),
        )?;

        // Update the chat's updated_at timestamp
        self.conn.execute(
            "UPDATE chats SET updated_at = ?1 WHERE id = ?2",
            (&message.created_at.to_rfc3339(), &message.chat_id),
        )?;

        Ok(message)
    }

    pub fn create_chat(&mut self, title: &str, model: &str) -> Result<Chat> {
        let chat = Chat {
            id: Uuid::new_v4().to_string(),
            title: title.to_string(),
            model: model.to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.conn.execute(
            "INSERT INTO chats (id, title, model, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &chat.id,
                &chat.title,
                &chat.model,
                &chat.created_at.to_rfc3339(),
                &chat.updated_at.to_rfc3339(),
            ),
        )?;

        Ok(chat)
    }

    // Read-only methods can keep &self
    pub fn get_chats(&self) -> Result<Vec<Chat>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, model, created_at, updated_at
             FROM chats
             ORDER BY updated_at DESC",
        )?;

        let chat_iter = stmt.query_map([], |row| {
            Ok(Chat {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .unwrap()
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .unwrap()
                    .with_timezone(&Utc),
            })
        })?;

        let mut chats = Vec::new();
        for chat in chat_iter {
            chats.push(chat?);
        }

        Ok(chats)
    }

    pub fn get_chat_messages(&self, chat_id: &str) -> Result<Vec<Message>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, chat_id, role, content, created_at
             FROM messages
             WHERE chat_id = ?1
             ORDER BY created_at ASC",
        )?;

        let message_iter = stmt.query_map([chat_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                chat_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .unwrap()
                    .with_timezone(&Utc),
            })
        })?;

        let mut messages = Vec::new();
        for message in message_iter {
            messages.push(message?);
        }

        Ok(messages)
    }
}
