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
var requests = require('./requests.json');

let versions = {
	v0: require('./v0.js'),
	v1: require('./v1.js')
};

(async () => {
	let cloudflareIpv4;
	let cloudflareIpv6;
	if (config.cloudflare) {
		cloudflareIpv4 = await fetch('https://www.cloudflare.com/ips-v4');
		if (cloudflareIpv4.status != 200) {
			console.log(`Couldn't fetch Cloudflare ip ranges (${cloudflareIpv4.status})`);
			process.exit();
		}
		cloudflareIpv4 = (await cloudflareIpv4.text()).split('\n').map(a => a.trim());

		cloudflareIpv6 = await fetch('https://www.cloudflare.com/ips-v6');
		if (cloudflareIpv6.status != 200) {
			console.log(`Couldn't fetch Cloudflare ip ranges (${cloudflareIpv6.status})`);
			process.exit();
		}
		cloudflareIpv6 = (await cloudflareIpv6.text()).split('\n').map(a => a.trim());
	}

	http.createServer(async (req, res) => {
		let userIp = req.socket.remoteAddress;
		if (!['127.0.0.0', '::1'].includes(userIp) && config.cloudflare) {
			if (userIp.startsWith('::ffff:')) userIp = userIp.slice(7);
			let v6 = userIp.includes(':');
			let cloudflareAddresses = v6 ? cloudflareIpv6 : cloudflareIpv4;
			let address = v6 ? ipAddress.Address6 : ipAddress.Address4;
			let isCloudflare = false;
			for (let i = 0; i < cloudflareAddresses.length && !isCloudflare; i++) if ((new address(userIp)).isInSubnet(new address(cloudflareAddresses[i]))) isCloudflare = true;
			if (!isCloudflare) {
				console.log(`Dropping non-cloudflare request (${userIp})`);
				return;
			}
		}

		const parsedUrl = url.parse(req.url);
		let version = parsedUrl.pathname.split('/')[1];
		if (versions[version] == null) versions.v0(req, res, pool, requests);
		else versions[version](req, res, pool, requests);
	}).listen(config.port);
})();

setInterval(async () => {
	if ((new Date()).getMinutes() == 0 && (new Date()).getSeconds() == 0) requests = {};
}, 1000);

const updateFile = () => {
	fs.writeFile('./requests.json', JSON.stringify(requests), () => setTimeout(updateFile, 1000));
}
updateFile();