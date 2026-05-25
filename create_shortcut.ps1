$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("C:\Users\Hp\Desktop\Trading Overlay.lnk")
$Shortcut.TargetPath = "C:\Users\Hp\OneDrive\Documents\drawing tool\Start-Trading-Overlay.bat"
$Shortcut.WorkingDirectory = "C:\Users\Hp\OneDrive\Documents\drawing tool"
$Shortcut.IconLocation = "C:\Users\Hp\OneDrive\Documents\drawing tool\overlay-app\src-tauri\icons\icon.ico"
$Shortcut.Save()
