const fs = require("fs")
const os = require("os")
const path = require("path")
const ROOT = path.join(__dirname, "..")
const NAME = "chimera-watchdog"
const DESC = "Chimera host watchdog"
const NODE = process.execPath
const SCRIPT = path.join(__dirname, "watchdog.js")

const systemd = () => {
	const unit = path.join(ROOT, `${NAME}.service`)
	fs.writeFileSync(unit, [
		"[Unit]",
		`Description=${DESC}`,
		"Requires=docker.service",
		"After=docker.service",
		"",
		"[Service]",
		`User=${os.userInfo().username}`,
		`WorkingDirectory=${ROOT}`,
		`ExecStart=${NODE} ${SCRIPT}`,
		"Restart=always",
		"RestartSec=30",
		"",
		"[Install]",
		"WantedBy=multi-user.target",
	].join("\n") + "\n")
	console.log(`wrote ${unit}\n`)
	console.log("run:")
	console.log(`  sudo cp ${unit} /etc/systemd/system/`)
	console.log(`  sudo systemctl enable --now ${NAME}`)
}

const launchd = () => {
	const plist = path.join(ROOT, "com.chimera.watchdog.plist")
	fs.writeFileSync(plist, [
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
		"<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
		"<plist version=\"1.0\">",
		"<dict>",
		"    <key>Label</key>",
		"    <string>com.chimera.watchdog</string>",
		"    <key>WorkingDirectory</key>",
		`    <string>${ROOT}</string>`,
		"    <key>ProgramArguments</key>",
		"    <array>",
		`        <string>${NODE}</string>`,
		`        <string>${SCRIPT}</string>`,
		"    </array>",
		"    <key>RunAtLoad</key>",
		"    <true/>",
		"    <key>KeepAlive</key>",
		"    <true/>",
		"    <key>StandardOutPath</key>",
		`    <string>${path.join(ROOT, "chimera-watchdog.log")}</string>`,
		"    <key>StandardErrorPath</key>",
		`    <string>${path.join(ROOT, "chimera-watchdog.log")}</string>`,
		"</dict>",
		"</plist>",
	].join("\n") + "\n")
	console.log(`wrote ${plist}\n`)
	console.log("run:")
	console.log(`  cp ${plist} ~/Library/LaunchAgents/`)
	console.log("  launchctl load ~/Library/LaunchAgents/com.chimera.watchdog.plist")
}

const win32 = () => {
	console.log("paste into an admin PowerShell:\n")
	console.log([
		`$action = New-ScheduledTaskAction -Execute "${NODE}" -Argument "${SCRIPT}" -WorkingDirectory "${ROOT}"`,
		"$trigger = New-ScheduledTaskTrigger -AtStartup",
		"$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Seconds 30)",
		`Register-ScheduledTask -TaskName "${NAME}" -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -RunLevel Highest`,
	].join("\n"))
}

const handlers = { linux: systemd, darwin: launchd, win32 }

const handler = handlers[process.platform]
if (!handler) {
	console.error(`unsupported platform: ${process.platform}`)
	process.exit(1)
}
handler()
