; =====================================================================
; UpdatePilot Agent - Inno Setup Script
; Architecture: Windows x64
; Model: Per-user installation (no admin elevation required for install)
; Target Output: UpdatePilot-Agent-Setup-1.0.0-x64.exe
; =====================================================================

[Setup]
AppId={{9F82A4C2-4E87-4C41-92D1-B101FE03D451}
AppName=UpdatePilot Agent
AppVersion=1.0.0
AppVerName=UpdatePilot Agent 1.0.0
AppPublisher=UpdatePilot
AppPublisherURL=https://github.com/sandunbandara978-rgb/UpdatePilot
AppSupportURL=https://github.com/sandunbandara978-rgb/UpdatePilot/issues
AppUpdatesURL=https://github.com/sandunbandara978-rgb/UpdatePilot/releases
DefaultDirName={localappdata}\Programs\UpdatePilot-Agent
DefaultGroupName=UpdatePilot Agent
DisableProgramGroupPage=yes
OutputBaseFilename=UpdatePilot-Agent-Setup-1.0.0-x64
OutputDir=..\dist\installer
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
DisableWelcomePage=no
ChangesEnvironment=no
UninstallDisplayName=UpdatePilot Agent 1.0.0
UninstallDisplayIcon={app}\bin\node.exe
CloseApplications=yes
CloseApplicationsFilter=*.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "Start UpdatePilot Agent automatically at user logon"; GroupDescription: "Background Service:"

[Files]
Source: "staging\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\UpdatePilot Setup Wizard"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\Setup-Wizard.ps1"""; WorkingDir: "{app}"; Comment: "Configure server URL and pairing code"
Name: "{group}\UpdatePilot Agent Service"; Filename: "{app}\bin\node.exe"; Parameters: """{app}\lib\agent\dist\index.js"" service"; WorkingDir: "{app}"; Comment: "Run UpdatePilot background agent"
Name: "{group}\Run Software Scan Now"; Filename: "{app}\UpdatePilot-Scan.cmd"; WorkingDir: "{app}"; Comment: "Scan installed applications immediately"
Name: "{group}\Agent Connection Status"; Filename: "{app}\UpdatePilot-Status.cmd"; WorkingDir: "{app}"; Comment: "Inspect device pairing and status"
Name: "{group}\Uninstall UpdatePilot Agent"; Filename: "{uninstallexe}"
Name: "{autodesktop}\UpdatePilot Setup Wizard"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\Setup-Wizard.ps1"""; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\UpdatePilot Agent"; Filename: "wscript.exe"; Parameters: """{app}\Start-Agent-Silent.vbs"""; WorkingDir: "{app}"; Tasks: startup

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\Setup-Wizard.ps1"""; Description: "Launch Setup Wizard to pair with your dashboard now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop any running UpdatePilot agent processes before uninstalling
Filename: "{app}\Stop-Agent.cmd"; Flags: runhidden

[UninstallDelete]
Type: files; Name: "{app}\agent.pid"
Type: filesandordirs; Name: "{app}\lib"
Type: filesandordirs; Name: "{app}\bin"
Type: filesandordirs; Name: "{app}\node_modules"

[Code]
// Pre-flight check for Windows Package Manager (winget)
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
  WinGetFound: Boolean;
  WinGetLocalPath: String;
begin
  Result := True;
  WinGetFound := False;

  // 1. Check using where.exe from system directory
  if Exec(ExpandConstant('{sys}\where.exe'), 'winget.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
      WinGetFound := True;
  end;

  // 2. Check standard WindowsApps path
  if not WinGetFound then
  begin
    WinGetLocalPath := ExpandConstant('{localappdata}') + '\Microsoft\WindowsApps\winget.exe';
    if FileExists(WinGetLocalPath) then
      WinGetFound := True;
  end;

  if (not WinGetFound) and (not WizardSilent) then
  begin
    MsgBox(
      'Notice: Windows Package Manager (winget) was not automatically detected on this system.' + #13#10 + #13#10 +
      'UpdatePilot Agent relies on winget to safely scan and install application updates.' + #13#10 + #13#10 +
      'You can continue installing the agent. If needed, install the "App Installer" package from ' +
      'the Microsoft Store or GitHub prior to running updates.',
      mbInformation, MB_OK
    );
  end;
end;

// Cleanup vault credentials on uninstall if requested
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  CredPath: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    CredPath := ExpandConstant('{localappdata}') + '\UpdatePilot';
    if DirExists(CredPath) then
    begin
      if MsgBox('Do you also want to remove UpdatePilot stored pairing credentials from this machine?', mbConfirmation, MB_YESNO) = idYes then
      begin
        DelTree(CredPath, True, True, True);
      end;
    end;
  end;
end;
