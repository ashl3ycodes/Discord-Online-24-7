require("dotenv").config();
const fetch = require("node-fetch");
const WebSocket = require("ws");

if(!process.env.DISCORD_OAUTH_TOKEN) {
	process.exit(1);
}

const config = {
	status: process.env.STATUS || "online",
	customStatusText: process.env.CUSTOM_STATUS_TEXT || ""
};

const headers = {
	Authorization: process.env.DISCORD_OAUTH_TOKEN,
	"Content-Type": "application/json",
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
};

async function validateToken() {
	try {
		const response = await fetch("https://discord.com/api/v9/users/@me", {headers});
		if(!response.ok) {
			throw new Error();
		}
		return await response.json();
	} catch {
		process.exit(1);
	}
}

function createWebSocketConnection(token) {
	return new Promise((resolve) => {
		const ws = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");
		let heartbeatInterval;

		ws.onmessage = (event) => {
			const message = JSON.parse(event.data);

			if(message.t === "READY") {
				console.log(`Logged as ${message.d.user.username} (${message.d.user.id})`);
			}

			switch(message.op) {
				case 10:
					heartbeatInterval = setInterval(() => {
						ws.send(JSON.stringify({op: 1, d: null}));
					}, message.d.heartbeat_interval);

					ws.send(JSON.stringify({
						op: 2,
						d: {
							token: token,
							properties: {$os: "linux", $browser: "chrome", $device: "chrome"},
							presence: {
								status: config.status,
								since: 0,
								activities: [{
									type: 4,
									name: "Custom Status",
									state: config.customStatusText
								}],
								afk: false
							}
						}
					}));
					break;
			}
		};

		ws.onclose = () => {
			clearInterval(heartbeatInterval);
			resolve();
		};
	});
}

async function main() {
	try {
		await validateToken();
		while(true) {
			try {
				await createWebSocketConnection(process.env.DISCORD_OAUTH_TOKEN);
				await new Promise(resolve => setTimeout(resolve, 5000));
			} catch {
				await new Promise(resolve => setTimeout(resolve, 10000));
			}
		}
	} catch {
		process.exit(1);
	}
}

main();