require("dotenv").config();
const fetch = require("node-fetch");
const WebSocket = require("ws");

if(!process.env.DISCORD_OAUTH_TOKEN) {
	console.error("ERROR: Set the DISCORD_OAUTH_TOKEN in the .env file.");
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

async function validateUserToken() {
	try {
		const response = await fetch("https://discord.com/api/v9/users/@me", {headers});
		if(!response.ok) {
			throw new Error("Invalid token or network error.");
		}
		return await response.json();
	} catch(error) {
		console.error("ERROR: The token you provided is invalid or expired.", error.message);
		process.exit(1);
	}
}

function setWebsocket(token, resolve) {
	let heartbeatTimer;
	const ws = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");

	function heartbeatCleanUp() {
		if(heartbeatTimer) {
			clearInterval(heartbeatTimer);
		}
	}

	function handleMessage(data) {
		try {
			const message = JSON.parse(data);
			if(message.op === 10) {
				const heartbeatInterval = message.d.heartbeat_interval;

				ws.send(JSON.stringify({
					op: 2,
					d: {
						token,
						properties: {$os: "windows", $browser: "chrome", $device: "desktop"},
						presence: {status: config.status, afk: false}
					}
				}));

				if(config.customStatusText) {
					ws.send(JSON.stringify({
						op: 3,
						d: {
							since: 0,
							activities: [{
								type: 4,
								state: config.customStatusText,
								name: "Custom Status"
							}],
							status: config.status,
							afk: false
						}
					}));
				}

				heartbeatTimer = setInterval(() => {
					if(ws.readyState === WebSocket.OPEN) {
						ws.send(JSON.stringify({op: 1, d: null}));
					}
				}, heartbeatInterval);

				setTimeout(() => {
					heartbeatCleanUp();
					ws.close();
					resolve();
				}, 45000);
			}
		} catch(error) {
			console.error("ERROR:", error.message);
		}
	}

	ws.on("error", error => {
		console.error("ERROR: WebSocket error:", error.message);
		heartbeatCleanUp();
	});
	ws.on("close", () => {
		heartbeatCleanUp();
	});

	return ws;
}

async function keepOnline(token) {
	return new Promise((resolve, reject) => {
		const ws = setWebsocket(token, resolve);

		ws.on("error", reject);
	});
}

async function run() {
	try {
		const {username, id} = await validateUserToken();
		console.log(`Logged as ${username} (${id})`);

		while(true) {
			try {
				await keepOnline(process.env.DISCORD_OAUTH_TOKEN);
				await new Promise(resolve => setTimeout(resolve, 5000));
			} catch(error) {
				console.error("ERROR: Connection failed, retrying...:", error.message);
				await new Promise(resolve => setTimeout(resolve, 10000));
			}
		}
	} catch(error) {
		console.error("ERROR:", error.message);
		process.exit(1);
	}
}

run().then();