from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import asyncio
import uuid

import database
import downloader

app = FastAPI(title="yt-dlp Web UI")

@app.on_event("startup")
async def startup_event():
    database.init_db()

# Ensure static directory exists
import os
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_index():
    return FileResponse("static/index.html")

from typing import Optional

class ParseRequest(BaseModel):
    url: str
    cookie_browser: Optional[str] = "auto"

@app.post("/api/parse")
def parse_url(req: ParseRequest):
    try:
        result = downloader.parse_video(req.url, req.cookie_browser)
        if result.get("success"):
            download_date = database.check_history(result["id"])
            result["already_downloaded"] = download_date
            return result
        return {"error": result.get("error"), "logs": result.get("logs", [])}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"Internal Server Error: {str(e)}"}

@app.get("/api/history")
def get_history():
    return database.get_all_history()

@app.post("/api/update")
def update_ytdlp():
    return downloader.update_ytdlp()

download_tasks = {}

class DownloadRequest(BaseModel):
    url: str
    format_id: str
    video_id: str
    title: str
    thumbnail: str
    channel: str
    duration: str
    ext: str
    cookie_browser: Optional[str] = "auto"

@app.post("/api/download")
async def start_download(req: DownloadRequest):
    task_id = str(uuid.uuid4())
    queue = asyncio.Queue()
    download_tasks[task_id] = queue
    
    database.add_history(
        req.video_id, req.title, req.thumbnail, req.channel, 
        req.duration, req.format_id, req.ext
    )

    asyncio.create_task(run_download_task(task_id, req.url, req.format_id, req.cookie_browser))
    
    return {"task_id": task_id}

async def run_download_task(task_id: str, url: str, format_id: str, cookie_browser: str):
    queue = download_tasks[task_id]
    await downloader.download_video(url, format_id, queue, cookie_browser)
    await queue.put({"status": "completed"})

@app.websocket("/ws/progress/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    if task_id not in download_tasks:
        await websocket.close(code=1000)
        return
    
    queue = download_tasks[task_id]
    try:
        while True:
            msg = await queue.get()
            await websocket.send_json(msg)
            if msg.get("status") in ["error", "completed"]:
                break
    except WebSocketDisconnect:
        pass
