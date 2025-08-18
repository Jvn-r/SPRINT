::Need a batch file coz wtrace needs Admin and a batch file seemed like a good way to do it
@echo off
setlocal

set CURDIR=%~dp0 
::This is because when i ran the .bat file without setting directory explicitly, the dir of bat file went through WINDOWS/System32... , and my python file was not in that dir.   

NET SESSION >nul 2>&1

IF %ERRORLEVEL% NEQ 0 (
    echo Requesting administrative privileges
    powershell -Command "Start-Process '%~f0' -WorkingDirectory '%CURDIR%' -Verb runAs"
    exit /b
)

cd /d "%CURDIR%"
echo Running wtrace with admin rights in %CD%

@echo off
wtrace.exe -f > opfile.txt
echo.
echo Press any key to stop wtrace...
pause > nul
::Added this coz Ctrl+C didnt work to stop wtrace a few times, so just as an eject button

