const fs = require('fs');
const http = require('http');
const url = require('url');
const pg = require('pg');
const ipAddress = require('ip-address');
const config = require('./config.json');
const pool = new pg.Pool({
    host: config.sql.host,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    database: config.sql.database,
    ssl: {
    	require: true,
        rejectUnauthorized: false
    },
	max: 20
});
let requests = {};
try {
	requests = JSON.parse(fs.readFileSync('requests.json').toString());
} catch (err) {
	console.error('requests.json missing or corrupted, creating new file.');
}
for (let ip of config.exclude) if (requests[ip] != null) requests[ip] = 0;

let versions = {
	// v0: require('./v0.js'),
	v1: require('./v1.js'),
	v2: require('./v2.js')
};

(async () => {
	if (config.cloudflare) {
		var cloudflareIpv4 = await fetch('https://www.cloudflare.com/ips-v4');
		if (cloudflareIpv4.status != 200) {
			console.log(`Couldn't fetch Cloudflare ip ranges (${cloudflareIpv4.status})`);
			process.exit();
		}
		cloudflareIpv4 = (await cloudflareIpv4.text()).split('\n').map(a => a.trim());
	
		var cloudflareIpv6 = await fetch('https://www.cloudflare.com/ips-v6');
		if (cloudflareIpv6.status != 200) {
			console.log(`Couldn't fetch Cloudflare ip ranges (${cloudflareIpv6.status})`);
			process.exit();
		}
		cloudflareIpv6 = (await cloudflareIpv6.text()).split('\n').map(a => a.trim());
	}

	http.createServer(async (req, res) => {
		let userIp = req.socket.remoteAddress;
		let isCloudflare = false;
		if (userIp.startsWith('::ffff:')) userIp = userIp.slice(7);
		if (config.cloudflare) {
			let v6 = userIp.includes(':');
			let cloudflareAddresses = v6 ? cloudflareIpv6 : cloudflareIpv4;
			let address = v6 ? ipAddress.Address6 : ipAddress.Address4;
			for (let i = 0; i < cloudflareAddresses.length && !isCloudflare; i++) if ((new address(userIp)).isInSubnet(new address(cloudflareAddresses[i]))) isCloudflare = true;
			if (isCloudflare) {
				userIp = req.headers['cf-connecting-ip'];
				if (userIp.startsWith('::ffff:')) userIp = userIp.slice(7);
			} else if (!config.exclude.includes(userIp)) {
				console.log(`Dropping non-cloudflare request (${userIp})`);
				return;
			}
		}
		if (config.proxy) {
			if (userIp == config.proxy) {
				if (req.headers['x-real-ip']) {
					userIp = req.headers['x-real-ip'];
					if (userIp.startsWith('::ffff:')) userIp = userIp.slice(7);
				}
			} else if (!config.exclude.includes(userIp)) {
				console.log(`Dropping non-proxy request (${userIp})`);
				return;
			}
		}

		const parsedUrl = new URL(`https://localhost${req.url}`);
		let version = parsedUrl.pathname.split('/')[1];
		if (versions[version] == null) {
			res.statusCode = 404;
			return res.end();
		} else versions[version]({ userIp, req, res, pool, requests, streamServers });
	}).listen(config.port);
	console.log(`Listening on port ${config.port}...`)
})();

setInterval(async () => {
	if ((new Date()).getMinutes() == 0 && (new Date()).getSeconds() == 0) requests = {};
}, 1000);

const updateFile = () => {
	fs.writeFile('./requests.json', JSON.stringify(requests), () => setTimeout(updateFile, 1000));
}
updateFile();


let twitchAccessToken;
let accessTokenTimeout = 0;
async function refreshAccessToken() {
    if (Math.floor((new Date()).getTime() / 1000) >= accessTokenTimeout - 21600) {
        const twitchResponse = await (await fetch(`https://id.twitch.tv/oauth2/token?client_id=${config.twitch.clientId}&client_secret=${config.twitch.secret}&grant_type=client_credentials`, {
            method: 'POST'
        })).json();
        twitchAccessToken = twitchResponse.access_token;
        accessTokenTimeout = (new Date()).getTime() / 1000 + twitchResponse.expires_in;
    }
}

let streamServers = [];
async function fetchStreams() {
	try {
		if (twitchAccessToken == null) await (new Promise(resolve => setInterval(() => { if (twitchAccessToken != null) resolve(); }, 100)));
	
		let streams = [];
		const options = {
			method: 'GET',
			headers: {
				'Client-ID': config.twitch.clientId,
				'Authorization': `Bearer ${twitchAccessToken}`
			}
		}
		if (config.twitch.log) console.log('[Twitch] Fetching streams...');
		let response = await (await fetch('https://api.twitch.tv/helix/streams?game_id=27471&first=100', options)).json();
		streams = response.data;
		do {
			try {
				response = await (await fetch(`https://api.twitch.tv/helix/streams?game_id=27471&first=100&after=${response.pagination.cursor}`, options)).json();
				streams = streams.concat(response.data);
			} catch (err) {}
		} while (response.pagination?.cursor != null)
		if (config.twitch.log) console.log(`[Twitch] Fetched ${streams.length} streams.`);
	
		if (config.twitch.log) console.log('[Twitch] Fetching servers...');
		let placeholder = 1;
		let result = await pool.query(`
			WITH servers AS (SELECT DISTINCT ON (p.serverId) s.*
			FROM playerhistory p JOIN servers s ON s.serverId = p.serverId
			WHERE (
				p.lastSession > ${Math.floor(Date.now() / 1000) - config.twitch.serverTimeout} AND
				p.lastSession = s.lastSeen AND
				${config.twitch.caseSensitive ? 'p.name' : 'LOWER(p.name)'} IN (${streams.map(a => `$${placeholder++}`).join(',')})))
			SELECT s.*, p.playerHistory FROM servers s
			CROSS JOIN LATERAL (
				SELECT json_agg(json_build_object('name', name, 'id', id, 'lastSession', lastSession))
				AS playerHistory FROM playerhistory p WHERE p.serverId = s.serverId) p`,
			streams.map(a => config.twitch.caseSensitive ? a.user_name : a.user_name.toLowerCase()));
		
		streamServers = result.rows.map(a => Object.assign({
			ip: a.ip + 2147483648,
			port: a.port + 32768,
			discovered: a.discovered,
			lastSeen: a.lastseen,
			version: {
				name: a.version,
				protocol: a.protocol,
			},
			description: a.description,
			rawDescription: a.rawdescription,
			players: {
				max: a.playerlimit,
				online: a.playercount,
				hasPlayerSample: a.hasplayersample
			},
			hasFavicon: a.hasfavicon,
			hasForgeData: a.hasforgedata,
			enforcesSecureChat: a.enforcessecurechat,
			org: a.org,
			geo: {
				country: a.country,
				city: a.city,
				lat: a.lat,
				lon: a.lon
			},
			cracked: a.cracked,
			whitelisted: a.whitelisted,
			playerHistory: a.playerhistory
		}));
		for (let result of streamServers) {
			result.streams = streams
				.filter(a => result.playerHistory.filter(a => a.lastSession == result.lastSeen).map(a => a.name.toLowerCase()).includes(a.user_name.toLowerCase()))
				.filter((a, i, arr) => !arr.slice(0, i).some(b => a.user_name == b.user_name))
				.slice(0, 10);
		}
		streamServers = streamServers.filter(a => a.streams.length > 0);
		if (config.twitch.log) console.log(`[Twitch] Fetched ${streamServers.length} servers.`);
	} catch (err) {
		console.error('Error fetching streamsnipes:');
		console.error(err);
	}

	setTimeout(fetchStreams);
}

if (config.twitch?.enabled) {
    refreshAccessToken();
    setInterval(refreshAccessToken, 7200);
    fetchStreams();
}