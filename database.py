import sqlite3
import os
from datetime import datetime

DB_FILE = "history.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            title TEXT,
            thumbnail TEXT,
            channel TEXT,
            duration TEXT,
            download_date TEXT,
            format_id TEXT,
            ext TEXT
        )
    ''')
    conn.commit()
    conn.close()

def add_history(video_id, title, thumbnail, channel, duration, format_id, ext):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO history (id, title, thumbnail, channel, duration, download_date, format_id, ext)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (video_id, title, thumbnail, channel, duration, now, format_id, ext))
        conn.commit()
    except Exception as e:
        print(f"DB Error: {e}")
    finally:
        conn.close()

def check_history(video_id):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT download_date FROM history WHERE id = ?', (video_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row[0] # Return the download date
    return None

def get_all_history():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM history ORDER BY download_date DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
