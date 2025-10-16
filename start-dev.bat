@echo off
echo Starting Azure Communication Service Demo...
echo.

echo Starting Backend Server on port 3000...
start "Backend Server" cmd /k "cd server && npm start"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend Server on port 4200...
start "Frontend Server" cmd /k "cd client && npm start"

echo.
echo Both servers are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:4200
echo.
echo Press any key to close this window...
pause > nul
