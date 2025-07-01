const fs = require('fs');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const pg = require('pg');
const config = require('./config.json');
const client = new pg.Client({
    host: config.sql.host,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    database: config.sql.database,
    ssl: {
    	require: true,
        rejectUnauthorized: false
    }
});
(async () => {
	await client.connect();
	console.log('Connected to database');
})();
var requests = require('./requests.json');
const favicon = fs.readFileSync('favicon.ico');

function addCondition(path, arg, value, conditions, vars, placeholder) {
	if (['/servers', '/count'].includes(path)) {
		switch (arg) {
			case 'playerCount': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "playerCount" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.playerCount = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'minPlayers': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "minPlayers" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.playerCount >= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'maxPlayers': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "maxPlayers" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.playerCount <= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'playerLimit': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "playerLimit" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.playerLimit = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'full': {
				if (!Array.isArray(value)) value = [value];
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "full" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map((a, i) => `s.playerCount ${value[i] == 'true' ? '>=' : '<'} s.playerLimit`).join(' OR ')}`);
				break;
			}
			case 'onlinePlayer': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (typeof item != 'string') return { error: `Invalid value for parameter "onlinePlayer" (${JSON.stringify(item)} is not a string)` };
				conditions.push(`EXISTS (SELECT 1 FROM history h JOIN players p ON h.playerId = p.playerId WHERE h.serverId = s.serverId AND h.lastSession = s.lastSeen AND p.name IN (${new Array(value.length).fill().map(a => `$${placeholder++}`)}) LIMIT 1)`);
				vars.push(...value);
				break;
			}
			case 'playerHistory': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (typeof item != 'string') return { error: `Invalid value for parameter "onlinePlayer" (${JSON.stringify(item)} is not a string)` };
				conditions.push(`EXISTS (SELECT 1 FROM history h JOIN players p ON h.playerId = p.playerId WHERE h.serverId = s.serverId AND p.name IN (${new Array(value.length).fill().map(a => `$${placeholder++}`)}) LIMIT 1)`);
				vars.push(...value);
				break;
			}
			case 'version': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `s.version LIKE $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'protocol': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "protocol" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.protocol = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'hasFavicon': {
				if (!Array.isArray(value)) value = [value];
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "hasFavicon" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.hasFavicon = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => a == 'true'));
				break;
			}
			case 'description': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `s.description LIKE $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'descriptionVector': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `s.descriptionVector @@ plainto_tsquery('simple', $${placeholder++})`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'hasPlayerSample': {
				if (!Array.isArray(value)) value = [value];
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "hasPlayerSample" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.hasPlayerSample = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => a == 'true'));
				break;
			}
			case 'seenAfter': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "seenAfter" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.lastSeen > $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'seenBefore': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "seenBefore" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.lastSeen < $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'ip': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "ip" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.ip = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'minIp': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "minIp" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.ip >= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'maxIp': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "maxIp" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.ip <= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'port': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "port" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.port = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 32768)));
				break;
			}
			case 'country': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `s.country = $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'org': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `s.org LIKE $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'cracked': {
				if (!Array.isArray(value)) value = [value];
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "cracked" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.cracked = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => a == 'true'));
				break;
			}
			case 'whitelisted': {
				if (!Array.isArray(value)) value = [value];
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "whitelisted" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.whitelisted = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => a == 'true'));
				break;
			}
			case 'vanilla': {
				if (!Array.isArray(value)) value = [value];
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "vanilla" (${item} is not a boolean)` };
				value = value.map(a => a == 'true');
				conditions.push(`${Array(value.length).fill().map((a, i) => `s.hasForgeData = ${!value[i]} ${value[i] ? 'AND' : 'OR'} s.version ${value[i] ? '' : 'NOT'} SIMILAR TO '[0-9]\.[0-9]{1,2}(\.[0-9])?'`).join(' OR ')}`);
				break;
			}
			default: {
				return { error: `Unknown parameter "${arg}"` };
			}
		}
	}
	if (path == '/bedrockServers') {
		switch (arg) {
			case 'education': {
				if (!Array.isArray(value)) value = [value];
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "education" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.education = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => a == 'true'));
				break;
			}
			case 'playerCount': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "playerCount" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.playerCount = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'minPlayers': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "minPlayers" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.playerCount >= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'maxPlayers': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "maxPlayers" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.playerCount <= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'playerLimit': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "playerLimit" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.playerLimit = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'full': {
				if (!Array.isArray(value)) value = [value];
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "full" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map((a, i) => `b.playerCount ${value[i] == 'true' ? '>=' : '<'} b.playerLimit`).join(' OR ')}`);
				break;
			}
			case 'version': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `b.version LIKE $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'protocol': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "protocol" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.protocol = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'description': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `(b.description LIKE $${placeholder} OR b.description2 LIKE $${placeholder++})`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'seenAfter': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "seenAfter" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.lastSeen > $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'seenBefore': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "seenBefore" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.lastSeen < $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'ip': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "ip" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.ip = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'minIp': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "minIp" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.ip >= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'maxIp': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "maxIp" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.ip <= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'port': {
				if (!Array.isArray(value)) value = [value];
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "port" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `b.port = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 32768)));
				break;
			}
			case 'gamemode': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `b.gamemode = $${placeholder}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'country': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `b.country = $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'org': {
				if (!Array.isArray(value)) value = [value];
				conditions.push(Array(value.length).fill().map(a => `b.org LIKE $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			default: {
				return { error: `Unknown parameter "${arg}"` };
			}
		}
	}
	return { placeholder };
}

http.createServer(async (req, res) => {
	const parsedUrl = url.parse(req.url);
	console.log(parsedUrl.pathname);
	if (req.method !== 'GET' && req.method !== 'POST') {
		res.statusCode = 405;
		res.end();
		return;
	}
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', '*');
	res.setHeader('Access-Control-Request-Method', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
	res.setHeader('Content-Type', 'application/json');
	res.statusCode = 400;
	
	if (parsedUrl.pathname.toLowerCase() == '/favicon.ico') {
		res.setHeader('Content-Type', 'image/x-icon');
		res.end(favicon);
		return;
	}
	
	if (req.headers['cf-connecting-ip'] != null && requests[req.headers['cf-connecting-ip']] == null) requests[req.headers['cf-connecting-ip']] = 0;
	let args = querystring.parse(parsedUrl.query);
	if (req.method == 'POST') {
		var body = '';
		await new Promise(resolve => req.on('data', (chunk) => body += chunk).on('end', resolve));
		try {
			body = JSON.parse(body);
		} catch (err) {
			res.end(JSON.stringify({ error: `Invalid body JSON: ${err}\n\n${body}` }));
			return;
		}
		try {
			for (const item in body) args[item] = body;
		} catch (err) {
			res.end(JSON.stringify({ error: 'Error handling request body' }))
			return;
		}
	}
	console.log(req.headers['cf-connecting-ip'] == null ? req.socket.remoteAddress : req.headers['cf-connecting-ip'], args);
	
	var skip = 0;
	var limit = 20;
	let placeholder = 1;
	let conditions = [];
	let vars = [];
	let sort;
	let descending = false;

	if (args.skip != null && !isNaN(args.skip) && !isNaN(parseInt(args.skip))) skip = parseInt(args.skip);
	delete args.skip;
	if (args.limit != null && !isNaN(args.limit) && !isNaN(parseInt(args.limit))) limit = parseInt(args.limit);
	delete args.limit;
	if (limit > 100) limit = 100;
	if (limit == 0) return res.end('[]');
	
	if (['/servers', '/count'].includes(parsedUrl.pathname)) {
		if (args.sort != null) {
			if (Array.isArray(args.sort)) args.sort = args.sort[0];
			if (!['lastSeen', 'discovered'].includes(args.sort)) {
				res.end(JSON.stringify({ error: `Invalid value for parameter "sort" (sorting by ${args.sort} is not supported)` }));
				return;
			}
			if (args.sort == 'lastSeen') sort = 's.lastSeen';
			if (args.sort == 'discovered') sort = 's.discovered';
			delete args.sort;
		}
		if (args.descending != null) {
			if (!['true', 'false'].includes(args.descending)) {
				res.end(JSON.stringify({ error: `Invalid value for parameter "descending" (${args.vanilla} is not a boolean)` }));
				return;
			}
			if (sort == null) {
				res.end(JSON.stringify({ error: `Cannot use parameter "descending" without specifing a sort value` }));
				return;
			}
			descending = args.descending == 'true';
			delete args.descending;
		}

		if (args.minIp != null || args.maxIp != null) {
			if (Array.isArray(args.minIp) || Array.isArray(args.maxIp)) {
				if (Math.abs(args.minIp.length - args.maxIp.length) > 1) {
					res.end(JSON.stringify({ error: `Invalid use of parameters "minIp" or "maxIp" (number of minIp and maxIp parameters must be equal or differ by one)` }));
					return;
				}
			} else {
				if (args.minIp != null) args.minIp = [args.minIp];
				if (args.maxIp != null) args.maxIp = [args.maxIp];
			}
			let ipRanges = [];
			for (let i = 0; i < Math.max(args.minIp.length, args.maxIp.length); i++) ipRanges.push({ minIp: args.minIp[i], maxIp: args.maxIp[i] });
			for (let range of ipRanges) {
				try { range.minIp = JSON.parse(range.minIp) } catch (err) {}
				try { range.maxIp = JSON.parse(range.maxIp) } catch (err) {}
				if (!(range.minIp == null || Array.isArray(range.minIp))) range.minIp = [range.minIp];
				if (!(range.maxIp == null || Array.isArray(range.maxIp))) range.maxIp = [range.maxIp];
				if (range.minIp != null && range.maxIp != null) {
					let condition = '';
					let len = Math.min(range.minIp.length, range.maxIp.length);
					if (Math.abs(range.minIp.length - range.maxIp.length) > 1) {
						res.end(JSON.stringify({ error: `Invalid length for parameter "${range.minIp.length > range.maxIp.length ? 'minIp' : 'maxIp'}" (lengths of minIp and maxIp must be equal or differ by one)` }));
						return;
					}
					for (const item of range.minIp) {
						if (isNaN(item) || isNaN(parseInt(item))) {
							res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${item} is not a number)` }));
							return;
						} else if (parseInt(item) < 0 || parseInt(item) > 4294967295) {
							res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${item} is not a valid ip address)` }));
							return;
						}
					}
					for (const item of range.maxIp) {
						if (isNaN(item) || isNaN(parseInt(item))) {
							res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${item} is not a number)` }));
							return;
						} else if (parseInt(item) < 0 || parseInt(item) > 4294967295) {
							res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${item} is not a valid ip address)` }));
							return;
						}
					}
					range.minIp = range.minIp.map(a => parseInt(a - 2147483648));
					range.maxIp = range.maxIp.map(a => parseInt(a - 2147483648));
					for (let i = 0; i < len; i++) {
						condition += `${condition == '' ? '' : ' OR'} (s.ip BETWEEN $${placeholder++} AND $${placeholder++})`;
						vars.push(range.minIp[i], range.maxIp[i]);
					}
					range.minIp.splice(0, len);
					range.maxIp.splice(0, len);
					if (range.minIp.length) {
						condition += `${condition == '' ? '' : ' OR'} (s.ip >= $${placeholder++})`;
						vars.push(range.minIp[0]);
					}
					if (range.maxIp.length) {
						condition += `${condition == '' ? '' : ' OR'} (s.ip <= $${placeholder++})`;
						vars.push(range.maxIp[0]);
					}
					conditions.push(`(${condition})`)
				}
			}
			delete args.minIp;
			delete args.maxIp;
		}

		for (const key in args) {
			for (let item of (Array.isArray(args[key]) ? args[key] : [args[key]])) {
				try {
					item = JSON.parse(item);
				} catch (err) {}
				let response = addCondition(parsedUrl.pathname, key, item, conditions, vars, placeholder);
				if (response.error != null) {
					res.end(JSON.stringify({ error: response.error }));
					return;
				}
				placeholder = response.placeholder;
			}
		}
	}

	if (parsedUrl.pathname == '/bedrockServers') {
		if (args.sort != null) {
			if (Array.isArray(args.sort)) args.sort = args.sort[0];
			if (!['lastSeen', 'discovered'].includes(args.sort)) {
				res.end(JSON.stringify({ error: `Invalid value for parameter "sort" (sorting by ${args.sort} is not supported)` }));
				return;
			}
			if (args.sort == 'lastSeen') sort = 'b.lastSeen';
			if (args.sort == 'discovered') sort = 'b.discovered';
			delete args.sort;
		}
		if (args.descending != null) {
			if (!['true', 'false'].includes(args.descending)) {
				res.end(JSON.stringify({ error: `Invalid value for parameter "descending" (${args.vanilla} is not a boolean)` }));
				return;
			}
			if (sort == null) {
				res.end(JSON.stringify({ error: `Cannot use parameter "descending" without specifing a sort value` }));
				return;
			}
			descending = args.descending == 'true';
			delete args.descending;
		}

		if (args.minIp != null || args.maxIp != null) {
			if (Array.isArray(args.minIp) || Array.isArray(args.maxIp)) {
				if (Math.abs(args.minIp.length - args.maxIp.length) > 1) {
					res.end(JSON.stringify({ error: `Invalid use of parameters "minIp" or "maxIp" (number of minIp and maxIp parameters must be equal or differ by one)` }));
					return;
				}
			} else {
				if (args.minIp != null) args.minIp = [args.minIp];
				if (args.maxIp != null) args.maxIp = [args.maxIp];
			}
			let ipRanges = [];
			for (let i = 0; i < Math.max(args.minIp.length, args.maxIp.length); i++) ipRanges.push({ minIp: args.minIp[i], maxIp: args.maxIp[i] });
			for (let range of ipRanges) {
				try { range.minIp = JSON.parse(range.minIp) } catch (err) {}
				try { range.maxIp = JSON.parse(range.maxIp) } catch (err) {}
				if (!(range.minIp == null || Array.isArray(range.minIp))) range.minIp = [range.minIp];
				if (!(range.maxIp == null || Array.isArray(range.maxIp))) range.maxIp = [range.maxIp];
				if (range.minIp != null && range.maxIp != null) {
					let condition = '';
					let len = Math.min(range.minIp.length, range.maxIp.length);
					if (Math.abs(range.minIp.length - range.maxIp.length) > 1) {
						res.end(JSON.stringify({ error: `Invalid length for parameter "${range.minIp.length > range.maxIp.length ? 'minIp' : 'maxIp'}" (lengths of minIp and maxIp must be equal or differ by one)` }));
						return;
					}
					for (const item of range.minIp) {
						if (isNaN(item) || isNaN(parseInt(item))) {
							res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${item} is not a number)` }));
							return;
						} else if (parseInt(item) < 0 || parseInt(item) > 4294967295) {
							res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${item} is not a valid ip address)` }));
							return;
						}
					}
					for (const item of range.maxIp) {
						if (isNaN(item) || isNaN(parseInt(item))) {
							res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${item} is not a number)` }));
							return;
						} else if (parseInt(item) < 0 || parseInt(item) > 4294967295) {
							res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${item} is not a valid ip address)` }));
							return;
						}
					}
					range.minIp = range.minIp.map(a => parseInt(a - 2147483648));
					range.maxIp = range.maxIp.map(a => parseInt(a - 2147483648));
					for (let i = 0; i < len; i++) {
						condition += `${condition == '' ? '' : ' OR'} (b.ip BETWEEN $${placeholder++} AND $${placeholder++})`;
						vars.push(range.minIp[i], range.maxIp[i]);
					}
					range.minIp.splice(0, len);
					range.maxIp.splice(0, len);
					if (range.minIp.length) {
						condition += `${condition == '' ? '' : ' OR'} (b.ip >= $${placeholder++})`;
						vars.push(range.minIp[0]);
					}
					if (range.maxIp.length) {
						condition += `${condition == '' ? '' : ' OR'} (b.ip <= $${placeholder++})`;
						vars.push(range.maxIp[0]);
					}
					conditions.push(`(${condition})`)
				}
			}
			delete args.minIp;
			delete args.maxIp;
		}

		for (const key in args) {
			for (let item of (Array.isArray(args[key]) ? args[key] : [args[key]])) {
				try {
					item = JSON.parse(item);
				} catch (err) {}
				let response = addCondition(parsedUrl.pathname, key, item, conditions, vars, placeholder);
				if (response.error != null) {
					res.end(JSON.stringify({ error: response.error }));
					return;
				}
				placeholder = response.placeholder;
			}
		}
	}

	if (parsedUrl.pathname == '/playerHistory') {
		if (args.ip == null) {
			res.end(JSON.stringify({ error: `Missing required parameter "ip"` }));
			return;
		} else {
			if (isNaN(args.ip) || isNaN(parseInt(args.ip))) {
				res.end(JSON.stringify({ error: `Invalid value for parameter "ip" (${args.ip} is not a number)` }));
				return;
			}
			conditions.push(`s.ip = $${placeholder++}`);
			vars.push(parseInt(args.ip - 2147483648));
			delete args.ip;
		}
		if (args.port == null) {
			res.end(JSON.stringify({ error: `Missing required parameter "port"` }));
			return;
		} else {
			if (isNaN(args.port) || isNaN(parseInt(args.port))) {
				res.end(JSON.stringify({ error: `Invalid value for parameter "port" (${args.port} is not a number)` }));
				return;
			}
			conditions.push(`s.port = $${placeholder++}`);
			vars.push(parseInt(args.port - 32768));
			delete args.port;
		}
	}
	
	res.statusCode = 200;
	if (parsedUrl.pathname == '/servers') {
		if (!(req.headers['cf-connecting-ip'] == null || config.exclude.includes(req.headers['cf-connecting-ip']))) {
			if (requests[req.headers['cf-connecting-ip']] >= 10000) {
				res.statusCode = 429;
				res.end(JSON.stringify({ error: 'Too many requests (Limit: 10,000 credits per hour)' }));
				return;
			}
			if (requests[req.headers['cf-connecting-ip']] + limit > 10000) limit = 10000 - requests[req.headers['cf-connecting-ip']];
			requests[req.headers['cf-connecting-ip']] += limit;
		}
		
		let query = `SELECT * FROM servers s ${conditions.length > 0 ? 'WHERE' : ''} ${conditions.map(a => `(${a})`).join(' AND ')} ${sort == null ? '' : `ORDER BY ${sort} ${descending ? 'DESC' : ''}`} LIMIT ${limit} OFFSET ${skip}`
		let result;
		try {
			result = await client.query(query, vars);
		} catch (err) {
			console.log(query);
			console.error(err);
			res.statusCode = 500;
			res.end(JSON.stringify({ error: 'Error constructing query' }));
			return;
		}

		res.end(JSON.stringify(result.rows.map(a => ({
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
			whitelisted: a.whitelisted
		}))));
	}

	if (parsedUrl.pathname == '/count') {
		if (!(req.headers['cf-connecting-ip'] == null || config.exclude.includes(req.headers['cf-connecting-ip']))) {
			if (requests[req.headers['cf-connecting-ip']] >= 10000) {
				res.statusCode = 429;
				res.end(JSON.stringify({ error: 'Too many requests (Limit: 10,000 credits per hour)' }));
				return;
			}
			if (requests[req.headers['cf-connecting-ip']] + limit > 10000) limit = 10000 - requests[req.headers['cf-connecting-ip']];
			requests[req.headers['cf-connecting-ip']] += limit;
		}
		
		let query = `SELECT COUNT(*) FROM servers s ${conditions.length > 0 ? 'WHERE' : ''} ${conditions.map(a => `(${a})`).join(' AND ')}`;
		let result;
		try {
			result = await client.query(query, vars);
		} catch (err) {
			console.log(query)
			console.error(err);
			res.statusCode = 500;
			res.end(JSON.stringify({ error: 'Error constructing query' }));
			return;
		}

		res.end(result.rows[0].count);
	}

	if (parsedUrl.pathname == '/playerHistory') {
		if (!(req.headers['cf-connecting-ip'] == null || config.exclude.includes(req.headers['cf-connecting-ip']))) {
			if (requests[req.headers['cf-connecting-ip']] >= 10000) {
				res.statusCode = 429;
				res.end(JSON.stringify({ error: 'Too many requests (Limit: 10,000 credits per hour)' }));
				return;
			}
			if (requests[req.headers['cf-connecting-ip']] + limit > 10000) limit = 10000 - requests[req.headers['cf-connecting-ip']];
			requests[req.headers['cf-connecting-ip']] += limit;
		}

		let query = `SELECT DISTINCT ON (p.playerId) * FROM servers s JOIN history h ON h.serverId = s.serverId JOIN players p ON h.playerId = p.playerId WHERE ${conditions.map(a => `(${a})`).join(' AND ')}`;
		let result;
		try {
			result = await client.query(query, vars);
		} catch (err) {
			console.log(query);
			console.error(err);
			res.statusCode = 500;
			res.end(JSON.stringify({ error: 'Error constructing query' }));
			return;
		}
		
		res.end(JSON.stringify(result.rows.map(a => ({
			name: a.name,
			id: a.id,
			lastSession: a.lastsession
		}))));
	}

	if (parsedUrl.pathname == '/bedrockServers') {
		if (!(req.headers['cf-connecting-ip'] == null || config.exclude.includes(req.headers['cf-connecting-ip']))) {
			if (requests[req.headers['cf-connecting-ip']] >= 10000) {
				res.statusCode = 429;
				res.end(JSON.stringify({ error: 'Too many requests (Limit: 10,000 credits per hour)' }));
				return;
			}
			if (requests[req.headers['cf-connecting-ip']] + limit > 10000) limit = 10000 - requests[req.headers['cf-connecting-ip']];
			requests[req.headers['cf-connecting-ip']] += limit;
		}
		
		let query = `SELECT * FROM bedrock b ${conditions.length > 0 ? 'WHERE' : ''} ${conditions.map(a => `(${a})`).join(' AND ')} ${sort == null ? '' : `ORDER BY ${sort} ${descending ? 'DESC' : ''}`} LIMIT ${limit} OFFSET ${skip}`
		let result;
		try {
			result = await client.query(query, vars);
		} catch (err) {
			console.log(query);
			console.error(err);
			res.statusCode = 500;
			res.end(JSON.stringify({ error: 'Error constructing query' }));
			return;
		}

		res.end(JSON.stringify(result.rows.map(a => (
			{
				ip: a.ip + 2147483648,
				port: a.port + 32768,
				discovered: a.discovered,
				lastSeen: a.lastseen,
				education: a.education,
				version: {
					name: a.version,
					protocol: a.protocol
				},
				description: a.description,
				rawDescription: a.rawdescription,
				description2: a.description2,
				rawDescription2: a.rawdescription2,
				players: {
					online: a.playercount,
					max: a.playerlimit
				},
				gamemode: {
					name: a.gamemode,
					id: a.modeid
				},
				org: a.org,
				geo: {
					country: a.country,
					city: a.city,
					lat: a.lat,
					lon: a.lon
				}
			}
		))));
	}
}).listen(config.port);

setInterval(async () => {
	if ((new Date()).getMinutes() == 0 && (new Date()).getSeconds() == 0) requests = {};
}, 1000);

const updateFile = () => {
	fs.writeFile('./requests.json', JSON.stringify(requests), () => setTimeout(updateFile, 1000));
}
updateFile();