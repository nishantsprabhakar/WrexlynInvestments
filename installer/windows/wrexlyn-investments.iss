; Wrexlyn for Investments — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
; Unauthorized copying, modification, or distribution is prohibited.
; See LICENSE for details.
;
; Builds Wrexlyn-Investments-Setup.exe: a per-user (no admin required) Windows
; installer. It ships the app's source + scripts (not node_modules/dist, which
; the existing first-run launcher already generates on the target machine —
; see scripts\launch.ps1), and creates Desktop/Start Menu shortcuts + an
; uninstaller.
;
; Build with: "C:\Users\<you>\AppData\Local\Programs\Inno Setup 6\ISCC.exe" wrexlyn-investments.iss

#define AppName "Wrexlyn for Investments"
#define AppVersion "0.1.0"
#define AppPublisher "Nishant Prabhakar"

[Setup]
AppId={{2B7E4F1D-9A3C-4B6E-8F2A-6D1C9E7B6A22}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\WrexlynInvestments
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=Wrexlyn-Investments-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\wrexlyn-investments.ico
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "wrexlyn-investments.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\public\*"; DestDir: "{app}\public"; Flags: recursesubdirs ignoreversion
Source: "..\..\server\*"; DestDir: "{app}\server"; Flags: recursesubdirs ignoreversion
Source: "..\..\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs ignoreversion
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\tsconfig.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\TERMS_OF_SERVICE.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\ACCEPTABLE_USE_POLICY.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\PRIVACY_POLICY.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\Start Wrexlyn Investments.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\Wrexlyn for Investments"; Filename: "{app}\Start Wrexlyn Investments.bat"; WorkingDir: "{app}"; IconFilename: "{app}\wrexlyn-investments.ico"
Name: "{group}\Wrexlyn for Investments"; Filename: "{app}\Start Wrexlyn Investments.bat"; WorkingDir: "{app}"; IconFilename: "{app}\wrexlyn-investments.ico"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"; IconFilename: "{app}\wrexlyn-investments.ico"

[Run]
Filename: "{app}\Start Wrexlyn Investments.bat"; Description: "Launch Wrexlyn for Investments now"; Flags: postinstall shellexec skipifsilent nowait

[UninstallDelete]
; The first-run launcher generates these on the target machine (npm install / npm run build) —
; Inno Setup only auto-removes what it itself installed, so these need an explicit cleanup
; entry for the uninstaller to leave nothing behind. `data\` (deal/portfolio records) is left
; in place deliberately — an uninstall should not silently destroy a fund's deal data; delete
; it by hand if that's really intended.
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\dist"
