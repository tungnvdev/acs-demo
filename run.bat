@echo off
echo Installing dependencies...
call npm run install-all

echo.
echo Starting development servers...
echo Backend will run on http://localhost:3000
echo Frontend will run on http://localhost:4200
echo.
echo Press Ctrl+C to stop both servers
echo.

call npm run dev

