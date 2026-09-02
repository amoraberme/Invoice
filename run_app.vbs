Option Explicit

Dim WshShell, fso, scriptDir, localAppData, progFiles, progFilesX86
Dim lockFile, browserCmd, url, i

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Set working directory to the directory of this VBScript file
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

url = "http://localhost:3000"

' Function to check if server is listening on port 3000 without popup windows
Function IsPortListening(port)
    Dim exitCode
    ' Run netstat silently, return exitCode 0 if found
    exitCode = WshShell.Run("cmd /c netstat -ano | findstr /R "":3000.*LISTENING"" >nul 2>&1", 0, True)
    If exitCode = 0 Then
        IsPortListening = True
    Else
        IsPortListening = False
    End If
End Function

' Check if server is already running
If Not IsPortListening(3000) Then
    ' Remove stale Next.js dev lock if present
    lockFile = scriptDir & "\.next\dev\lock"
    If fso.FileExists(lockFile) Then
        On Error Resume Next
        fso.DeleteFile lockFile, True
        On Error GoTo 0
    End If

    ' Start dev server hidden
    WshShell.Run "cmd /c pnpm dev", 0, False

    ' Wait for server to start (up to 10 seconds)
    For i = 1 To 20
        WScript.Sleep 500
        If IsPortListening(3000) Then Exit For
    Next
End If

' Resolve browser paths
localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
progFiles = WshShell.ExpandEnvironmentStrings("%ProgramFiles%")
progFilesX86 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%")

browserCmd = ""

If fso.FileExists(progFiles & "\Google\Chrome\Application\chrome.exe") Then
    browserCmd = """" & progFiles & "\Google\Chrome\Application\chrome.exe"" --app=" & url
ElseIf fso.FileExists(progFilesX86 & "\Google\Chrome\Application\chrome.exe") Then
    browserCmd = """" & progFilesX86 & "\Google\Chrome\Application\chrome.exe"" --app=" & url
ElseIf fso.FileExists(localAppData & "\Google\Chrome\Application\chrome.exe") Then
    browserCmd = """" & localAppData & "\Google\Chrome\Application\chrome.exe"" --app=" & url
ElseIf fso.FileExists(progFiles & "\Microsoft\Edge\Application\msedge.exe") Then
    browserCmd = """" & progFiles & "\Microsoft\Edge\Application\msedge.exe"" --app=" & url
ElseIf fso.FileExists(progFilesX86 & "\Microsoft\Edge\Application\msedge.exe") Then
    browserCmd = """" & progFilesX86 & "\Microsoft\Edge\Application\msedge.exe"" --app=" & url
ElseIf fso.FileExists(localAppData & "\Microsoft\Edge\Application\msedge.exe") Then
    browserCmd = """" & localAppData & "\Microsoft\Edge\Application\msedge.exe"" --app=" & url
Else
    browserCmd = "cmd /c start " & url
End If

WshShell.Run browserCmd
