@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto no_node
if exist node_modules goto build
call npm.cmd ci
if errorlevel 1 goto failed
:build
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo 请在本机浏览器打开 http://127.0.0.1:3000
echo 另开独立标签页可模拟队友；关闭此窗口将停止游戏服务。
echo.
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:no_node
echo 请先安装 Node.js 22.12 或更新的受支持版本。
pause
exit /b 1
:failed
echo 启动失败，请保留上方错误信息。
pause
exit /b 1
