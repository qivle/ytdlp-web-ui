@echo off
:: Set Command Prompt Title
title yt-dlp Web UI

echo ===================================================
echo             yt-dlp Web UI Runner
echo ===================================================
echo.

:: Check if Python is installed
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to PATH!
    echo Please install Python (3.9 or higher) from https://www.python.org/
    pause
    exit /b 1
)

:: Check if venv directory exists, if not, create and initialize it
if not exist "venv" (
    echo [INFO] Virtual environment 'venv' not found. Creating a new one...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo [INFO] Virtual environment created successfully.
    
    echo [INFO] Activating virtual environment and installing dependencies...
    call venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo [INFO] Dependencies installed successfully.
) else (
    echo [INFO] Virtual environment found. Activating...
    call venv\Scripts\activate.bat
)

:: Wait 1 second and open browser to the local page
echo [INFO] Opening Web UI in browser...
timeout /t 1 /nobreak >nul
start http://localhost:8000

:: Run the FastAPI application using uvicorn
echo [INFO] Starting FastAPI server on port 8000...
uvicorn main:app --host 0.0.0.0 --port 8000

:: If the server exits, keep the command window open for debugging
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application crashed or stopped unexpectedly!
    pause
)
