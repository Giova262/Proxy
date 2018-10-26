@ECHO off
TITLE TERA Proxy
CD /d "%~dp0"

WHERE node > NUL 2> NUL
IF %ERRORLEVEL% NEQ 0 (
	ECHO Node.JS not found.
	ECHO Please install the latest Current from https://nodejs.org/
	PAUSE
	EXIT
)

node --harmony-bigint -e "" 2> NUL
IF %ERRORLEVEL% NEQ 0 (
	ECHO Your version of Node.JS is outdated.
	ECHO Please install the latest Current from https://nodejs.org/
	PAUSE
	EXIT
)

IF NOT EXIST ./bin/config.json (
	ECHO Please select your gameserver region in the prompt and press OK.
	START /WAIT server-select
	CLS
)

node --harmony-bigint ./bin/lib/proxy.js
PAUSE