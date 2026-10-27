@echo off
title Explore Worlds - Servidor
cd /d "%~dp0"
set PORT=8137
set URL=http://localhost:%PORT%

where python >nul 2>nul && (set "SERVER=python -m http.server %PORT%" & goto run)
where py >nul 2>nul && (set "SERVER=py -m http.server %PORT%" & goto run)
where npx >nul 2>nul && (set "SERVER=npx --yes http-server -p %PORT% -c-1" & goto run)

echo Python ou Node nao encontrados. Abrindo index.html direto no navegador...
start "" "%~dp0index.html"
exit /b

:run
echo Iniciando servidor em %URL%
echo Feche esta janela (ou Ctrl+C) para parar o servidor.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start "" %URL%"
%SERVER%
