@echo off
rem Pornit lunar de Task Scheduler (catalincocos - statistici lunare GSC+GA). Se poate rula si manual.
cd /d "D:\Claude\catalincocos.ro"
"C:\Program Files\nodejs\node.exe" tools\statistici-lunare.js > notite\statistici-ultima-rulare.log 2>&1
