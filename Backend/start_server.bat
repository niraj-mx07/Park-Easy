@echo off
setlocal enabledelayedexpansion

REM Ensure we are in the directory of this script
cd /d "%~dp0"

echo Starting Parking System Backend Server...
echo.

REM Verify requirements file exists
if not exist "requirements.txt" (
    echo Error: requirements.txt not found in %cd%
    echo Make sure you are running this from the Backend folder.
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo Error: Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo Activating virtual environment...
call "venv\Scripts\activate.bat"

REM Upgrade pip (optional but recommended)
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

REM Start the server
echo Starting server...
python run.py

pause
