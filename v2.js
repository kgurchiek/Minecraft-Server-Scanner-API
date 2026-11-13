/*
Major changes:
- new includePlayers argument returns player history in /servers responses
- /playerHistory has been removed
- you can now put args in the "data" property of an object to allow for additional settings to be included
  - caseInsensitive option added for onlinePlayer and playerHistory
- /streamsnipe uses the Twitch api to find live streamers
*/


const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const favicon = fs.readFileSync('favicon.ico');
const config = require('./config.json');

function addCondition(path, arg, value, cteConditions, conditions, vars, placeholder, options) {
	if (value == null) value = 'null';
	if (['servers', 'count'].includes(path)) {
		switch (arg) {
			case 'playerCount': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "playerCount" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.playerCount = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'minPlayers': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "minPlayers" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.playerCount >= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'maxPlayers': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "maxPlayers" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.playerCount <= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'playerLimit': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "playerLimit" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.playerLimit = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'full': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "full" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map((a, i) => `s.playerCount ${value[i] == 'true' ? '>=' : '<'} s.playerLimit`).join(' OR ')}`);
				break;
			}
			case 'onlinePlayer': {
				value = value.map(a => typeof a == 'string' ? a : String(a));
				if (options.caseInsensitive) value = value.map(a => a.toLowerCase());
				cteConditions.push(`p.lastSession = s.lastSeen AND ${options.caseInsensitive ? 'LOWER(p.name)' : 'p.name'} IN (${new Array(value.length).fill().map(a => `$${placeholder++}`)})`);
				vars.push(...value);
				break;
			}
			case 'onlineUuid': {
				value = value.map(a => typeof a == 'string' ? a : String(a));
				cteConditions.push(`p.lastSession = s.lastSeen AND p.id IN (${new Array(value.length).fill().map(a => `$${placeholder++}`)})`);
				vars.push(...value);
				break;
			}
			case 'playerHistory': {
				value = value.map(a => typeof a == 'string' ? a : String(a));
				if (options.caseInsensitive) value = value.map(a => a.toLowerCase());
				cteConditions.push(`${options.caseInsensitive ? 'LOWER(p.name)' : 'p.name'} IN (${new Array(value.length).fill().map(a => `$${placeholder++}`)})`);
				vars.push(...value);
				break;
			}
			case 'uuidHistory': {
				value = value.map(a => typeof a == 'string' ? a : String(a));
				cteConditions.push(`p.id IN (${new Array(value.length).fill().map(a => `$${placeholder++}`)})`);
				vars.push(...value);
				break;
			}
			case 'version': {
				conditions.push(Array(value.length).fill().map(a => `s.version LIKE $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'protocol': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "protocol" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.protocol = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'hasFavicon': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "hasFavicon" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.hasFavicon = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => a == 'true'));
				break;
			}
			case 'description': {
				conditions.push(Array(value.length).fill().map(a => `s.description LIKE $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'descriptionVector': {
				conditions.push(Array(value.length).fill().map(a => `s.descriptionVector @@ plainto_tsquery('simple', $${placeholder++})`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'hasPlayerSample': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "hasPlayerSample" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.hasPlayerSample = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => a == 'true'));
				break;
			}
			case 'hasPlayerHistory': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "hasPlayerHistory" (${item} is not a boolean)` };
				conditions.push(`${value.map(a => `${a == 'true' ? '' : 'NOT'} EXISTS (SELECT 1 FROM playerHistory p WHERE p.serverId = s.serverId LIMIT 1)`).join(' OR ')}`);
				break;
			}
			case 'seenAfter': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "seenAfter" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.lastSeen > $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'seenBefore': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "seenBefore" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.lastSeen < $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a)));
				break;
			}
			case 'ip': {
				for (let i = 0; i < value.length; i++) {
					let item = value[i];
					if (typeof item === 'number' && item % 1 > 0) return { error: `Invalid value for parameter "ip" (${item} is not an integer)` };
					if (typeof item === 'string') {
						let arr = item.split('.').map(a => parseInt(a));
						if (arr.length != 4 || arr.some(a => isNaN(a))) return { error: `Invalid value for parameter "ip" (${item} is not a valid ip address)` };
						item = value[i] = arr.reduce((a, b, i, arr) => a + (b * 256**(arr.length - i - 1)), 0);
					}
				}
				conditions.push(`${Array(value.length).fill().map(a => `s.ip = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'minIp': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "minIp" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.ip >= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'maxIp': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "maxIp" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.ip <= $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 2147483648)));
				break;
			}
			case 'port': {
				for (let item of value) if (isNaN(item) || isNaN(parseInt(item))) return { error: `Invalid value for parameter "port" (${item} is not a number)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.port = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => parseInt(a - 32768)));
				break;
			}
			case 'enforcesSecureChat': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false', 'null'].includes(item)) return { error: `Invalid value for parameter "enforcesSecureChat" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map((a, i) => value[i] == 'null' ? 's.enforcessecurechat IS NULL' : `s.enforcessecurechat = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.filter(a => a != 'null').map(a => a == 'true'));
				break;
			}
			case 'country': {
				conditions.push(Array(value.length).fill().map(a => `s.country = $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'org': {
				conditions.push(Array(value.length).fill().map(a => `s.org LIKE $${placeholder++}`).join(' OR '));
				vars.push(...value);
				break;
			}
			case 'cracked': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false', 'null'].includes(item)) return { error: `Invalid value for parameter "cracked" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map((a, i) => value[i] == 'null' ? 's.cracked IS NULL' :  `s.cracked = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.filter(a => a != 'null').map(a => a == 'true'));
				break;
			}
			case 'whitelisted': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false', 'null'].includes(item)) return { error: `Invalid value for parameter "whitelisted" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map((a, i) => value[i] == 'null' ? 's.whitelisted IS NULL'  : `s.whitelisted = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.filter(a => a != 'null').map(a => a == 'true'));
				break;
			}
			case 'vanilla': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "vanilla" (${item} is not a boolean)` };
				value = value.map(a => a == 'true');
				conditions.push(`${Array(value.length).fill().map((a, i) => `s.hasForgeData = ${!value[i]} ${value[i] ? 'AND' : 'OR'} s.version ${value[i] ? '' : 'NOT'} SIMILAR TO '[0-9]\.[0-9]{1,2}(\.[0-9])?'`).join(' OR ')}`);
				break;
			}
			case 'forge': {
				value = value.map(a => a.toString().toLowerCase());
				for (let item of value) if (!['true', 'false'].includes(item)) return { error: `Invalid value for parameter "forge" (${item} is not a boolean)` };
				conditions.push(`${Array(value.length).fill().map(a => `s.hasForgeData = $${placeholder++}`).join(' OR ')}`);
				vars.push(...value.map(a => a == 'true'));
				break;
			}
			default: {
				return { error: `Unknown parameter "${arg}"` };
			}
		}
	}
	if (['bedrockServers', 'bedrockCount'].includes(path)) {
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
				for (let i = 0; i < value.length; i++) {
					let item = value[i];
					if (typeof item === 'number' && item % 1 > 0) return { error: `Invalid value for parameter "ip" (${item} is not an integer)` };
					if (typeof item === 'string') {
						let arr = item.split('.').map(a => parseInt(a));
						if (arr.length != 4 || arr.some(a => isNaN(a))) return { error: `Invalid value for parameter "ip" (${item} is not a valid ip address)` };
						item = value[i] = arr.reduce((a, b, i, arr) => a + (b * 256**(arr.length - i - 1)), 0);
					}
				}
				conditions.push(`${Array(value.length).fill().map(a => `s.ip = $${placeholder++}`).join(' OR ')}`);
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
				conditions.push(Array(value.length).fill().map(a => `LOWER(b.gamemode) = $${placeholder}`).join(' OR '));
				vars.push(...value.map(a => a.toLowerCase()));
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

module.exports = async ({ userIp, req, res, pool, requests, streamServers }) => {
	const parsedUrl = new URL(`https://localhost${req.url}`);
	console.log(parsedUrl.pathname);
	let endpoint = parsedUrl.pathname.split('/')[2] || '/';
	if (!['GET', 'POST'].includes(req.method)) {
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
	
	if (endpoint.toLowerCase() == 'favicon.ico') {
		res.setHeader('Content-Type', 'image/x-icon');
		res.end(favicon);
		return;
	}
	
	if (requests[userIp] == null) requests[userIp] = 0;
	let rateLimit = true;
	if (config.exclude.includes(userIp)) rateLimit = false;

	let args = querystring.parse(parsedUrl.search.slice(1));
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
			for (const item in body) args[item] = (typeof body[item] == 'string' ? body[item] : JSON.stringify(body[item]));
		} catch (err) {
			res.end(JSON.stringify({ error: 'Error handling request body' }));
			return;
		}
	}
	console.log(userIp, args);

	if (endpoint == 'credits') {
		if (rateLimit) requests[userIp]++;
		res.statusCode = 200;
		res.end(JSON.stringify({ credits: Math.max(0, config.maxCredits - requests[userIp]), max: config.maxCredits }));
		return;
	}

	if (endpoint == 'streamsnipe') {
		if (rateLimit) requests[userIp]++;
		if (!config.twitch.enabled) {
			res.statusCode = 404;
			res.end();
			return;
		}
		let servers = streamServers;
		if (args.language != null) {
			let language = Array.isArray(args.language) ? args.language : [args.language];
			servers = servers.filter(a => a.streams.some(b => language.includes(b.language)));
		}
		res.end(JSON.stringify({ data: servers, credits: Math.max(0, config.maxCredits - requests[userIp])}));
		return;
	}

	if (!['servers', 'count', 'bedrockServers', 'bedrockCount'].includes(endpoint)) {
		res.statusCode = '404';
		res.removeHeader('Content-Type');
		res.end();
		return;
	}
	
	var skip = 0;
	var limit = 20;
	let placeholder = 1;
	let cteConditions = [];
	let conditions = [];
	let vars = [];
	let sort;
	let descending = false;
	let includePlayers = false;
	let ipType = 'integer';

	if (args.skip != null && !isNaN(args.skip) && !isNaN(parseInt(args.skip))) skip = parseInt(args.skip);
	delete args.skip;
	if (args.limit != null && !isNaN(args.limit) && !isNaN(parseInt(args.limit))) limit = parseInt(args.limit);
	delete args.limit;
	if (limit > 1000) limit = 1000;
	if (limit <= 0) {
		if (rateLimit) requests[userIp]++;
		return res.end(JSON.stringify({ data: [], credits: Math.max(0, config.maxCredits - requests[userIp]) }));
	}

	if (['servers', 'count'].includes(endpoint)) {
		if (args.sort != null) {
			if (Array.isArray(args.sort)) args.sort = args.sort[0];
			if (!['lastSeen', 'discovered'].includes(args.sort)) return res.end(JSON.stringify({ error: `Invalid value for parameter "sort" (sorting by ${args.sort} is not supported)` }));
			if (args.sort == 'lastSeen') sort = 's.lastSeen';
			if (args.sort == 'discovered') sort = 's.discovered';
			delete args.sort;
		}

		if (args.descending != null) {
			if (!['true', 'false'].includes(args.descending)) return res.end(JSON.stringify({ error: `Invalid value for parameter "descending" (${args.vanilla} is not a boolean)` }));
			if (sort == null) return res.end(JSON.stringify({ error: `Cannot use parameter "descending" without specifing a sort value` }));
			descending = args.descending == 'true';
			delete args.descending;
		}

		if (args.minIp != null || args.maxIp != null) {
			if (Array.isArray(args.minIp) || Array.isArray(args.maxIp)) {
				if (Math.abs(args.minIp.length - args.maxIp.length) > 1) {
					return res.end(JSON.stringify({ error: `Invalid use of parameters "minIp" or "maxIp" (number of minIp and maxIp parameters must be equal or differ by one)` }));
				}
			} else {
				if (args.minIp != null) args.minIp = [args.minIp];
				if (args.maxIp != null) args.maxIp = [args.maxIp];
			}
			let ipRanges = [];
			for (let i = 0; i < Math.max(args.minIp?.length || 0, args.maxIp?.length || 0); i++) {
				let minIp = args.minIp?.[i] || 0;
				let maxIp = args.maxIp?.[i] || (256**4 - 1);
				if (typeof minIp === 'string') {
					let arr = minIp.split('.').map(a => parseInt(a));
					if (arr.length != 4 || arr.some(a => isNaN(a))) return res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${minIp} is not a valid ip address)` }));
					minIp = arr.reduce((a, b, i, arr) => a + (b * 256**(arr.length - i - 1)), 0);
				}
				if (typeof maxIp === 'string') {
					let arr = maxIp.split('.').map(a => parseInt(a));
					if (arr.length != 4 || arr.some(a => isNaN(a))) return res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${maxIp} is not a valid ip address)` }));
					maxIp = arr.reduce((a, b, i, arr) => a + (b * 256**(arr.length - i - 1)), 0);
				}
				ipRanges.push({ minIp, maxIp });
			}
			for (let range of ipRanges) {
				try { range.minIp = JSON.parse(range.minIp) } catch (err) {}
				try { range.maxIp = JSON.parse(range.maxIp) } catch (err) {}
				if (!(range.minIp == null || Array.isArray(range.minIp))) range.minIp = [range.minIp];
				if (!(range.maxIp == null || Array.isArray(range.maxIp))) range.maxIp = [range.maxIp];
				if (range.minIp != null && range.maxIp != null) {
					let condition = '';
					let len = Math.min(range.minIp.length, range.maxIp.length);
					if (Math.abs(range.minIp.length - range.maxIp.length) > 1) return res.end(JSON.stringify({ error: `Invalid length for parameter "${range.minIp.length > range.maxIp.length ? 'minIp' : 'maxIp'}" (lengths of minIp and maxIp must be equal or differ by one)` }));
					for (const item of range.minIp) {
						if (isNaN(item) || isNaN(parseInt(item))) return res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${item} is not a number)` }));
						if (parseInt(item) < 0 || parseInt(item) > 4294967295) return res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${item} is not a valid ip address)` }));
					}
					for (const item of range.maxIp) {
						if (isNaN(item) || isNaN(parseInt(item))) return res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${item} is not a number)` }));
						else if (parseInt(item) < 0 || parseInt(item) > 4294967295) return res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${item} is not a valid ip address)` }));
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

		if (args.includePlayers != null) {
			if (!['true', 'false'].includes(args.includePlayers)) return res.end(JSON.stringify({ error: `Invalid value for parameter "includePlayers" (${args.includePlayers} is not a boolean)` }));
			includePlayers = args.includePlayers == 'true';
			delete args.includePlayers;
		}

		if (args.ipType != null) {
			if (!['integer', 'decimal'].includes(args.ipType)) return res.end(JSON.stringify({ error: `Invalid value for parameter "ipType" (${args.ipType} must be "integer" or "decimal")` }));
			ipType = args.ipType;
			delete args.ipType;
		}

		for (const key in args) {
			for (let item of (Array.isArray(args[key]) ? args[key] : [args[key]])) {
				try {
					item = JSON.parse(item);
				} catch (err) {}
				let options = {};
				if (typeof item == 'object' && !Array.isArray(item)) {
					let obj = item;
					item = item.data;
					delete obj.data;
					Object.assign(options, obj);
				}
				if (!Array.isArray(item)) item = [item];
				if (item.length == 0) continue;
				let response = addCondition(endpoint, key, item, cteConditions, conditions, vars, placeholder, options);
				if (response.error != null) {
					res.end(JSON.stringify({ error: response.error }));
					return;
				}
				placeholder = response.placeholder;
			}
		}
	}

	if (['bedrockServers', 'bedrockCount'].includes(endpoint)) {
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
			for (let i = 0; i < Math.max(args.minIp?.length || 0, args.maxIp?.length || 0); i++) {
				let minIp = args.minIp?.[i] || 0;
				let maxIp = args.maxIp?.[i] || (256**4 - 1);
				if (typeof minIp === 'string') {
					let arr = minIp.split('.').map(a => parseInt(a));
					if (arr.length != 4 || arr.some(a => isNaN(a))) return res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${minIp} is not a valid ip address)` }));
					minIp = arr.reduce((a, b, i, arr) => a + (b * 256**(arr.length - i - 1)), 0);
				}
				if (typeof maxIp === 'string') {
					let arr = maxIp.split('.').map(a => parseInt(a));
					if (arr.length != 4 || arr.some(a => isNaN(a))) return res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${maxIp} is not a valid ip address)` }));
					maxIp = arr.reduce((a, b, i, arr) => a + (b * 256**(arr.length - i - 1)), 0);
				}
				ipRanges.push({ minIp, maxIp });
			}
			for (let range of ipRanges) {
				try { range.minIp = JSON.parse(range.minIp) } catch (err) {}
				try { range.maxIp = JSON.parse(range.maxIp) } catch (err) {}
				if (!(range.minIp == null || Array.isArray(range.minIp))) range.minIp = [range.minIp];
				if (!(range.maxIp == null || Array.isArray(range.maxIp))) range.maxIp = [range.maxIp];
				if (range.minIp != null && range.maxIp != null) {
					let condition = '';
					let len = Math.min(range.minIp.length, range.maxIp.length);
					if (Math.abs(range.minIp.length - range.maxIp.length) > 1) return res.end(JSON.stringify({ error: `Invalid length for parameter "${range.minIp.length > range.maxIp.length ? 'minIp' : 'maxIp'}" (lengths of minIp and maxIp must be equal or differ by one)` }));
					for (const item of range.minIp) {
						if (isNaN(item) || isNaN(parseInt(item))) return res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${item} is not a number)` }));
						if (parseInt(item) < 0 || parseInt(item) > 4294967295) return res.end(JSON.stringify({ error: `Invalid value for parameter "minIp" (${item} is not a valid ip address)` }));
					}
					for (const item of range.maxIp) {
						if (isNaN(item) || isNaN(parseInt(item))) return res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${item} is not a number)` }));
						else if (parseInt(item) < 0 || parseInt(item) > 4294967295) return res.end(JSON.stringify({ error: `Invalid value for parameter "maxIp" (${item} is not a valid ip address)` }));
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
				let options = {};
				if (typeof item == 'object') {
					let obj = item;
					item = item.data;
					delete obj.data;
					Object.assign(options, obj);
				}
				if (!Array.isArray(item)) item = [item];
				if (item.length == 0) continue;
				let response = addCondition(endpoint, key, item, cteConditions, conditions, vars, placeholder, options);
				if (response.error != null) {
					res.end(JSON.stringify({ error: response.error }));
					return;
				}
				placeholder = response.placeholder;
			}
		}
	}
	
	res.statusCode = 200;
	if (endpoint == 'servers') {
		if (!config.exclude.includes(userIp)) {
			if (requests[userIp] >= config.maxCredits) {
				res.statusCode = 429;
				res.end(JSON.stringify({ error: `Too many requests (Limit: ${config.maxCredits.toLocaleString()} credits per hour)` }));
				return;
			}
			if (requests[userIp] + limit > config.maxCredits) limit = Math.max(0, config.maxCredits - requests[userIp]);
			if (rateLimit) requests[userIp] += Math.max(10, limit);
		}
		
		let select = includePlayers ? `s.*, p.playerHistory` : '*';
		let cteServers = `WITH servers AS (SELECT DISTINCT ON (p.serverId) s.* FROM playerhistory p JOIN servers s ON s.serverId = p.serverId WHERE ${cteConditions.map(a => `(${a})`).join(' AND ')})`;
		let where = conditions.length == 0 ? '' : `WHERE ${conditions.map(a => `(${a})`).join(' AND ')}`;
		let join = includePlayers ? `CROSS JOIN LATERAL (SELECT json_agg(json_build_object('name', name, 'id', id, 'lastSession', lastSession)) AS playerHistory FROM playerhistory p WHERE p.serverId = s.serverId) p` : '';
		let query = `${cteConditions.length > 0 ? cteServers : ''} SELECT ${select} FROM servers s ${join} ${where} ${sort == null ? '' : `ORDER BY ${sort} ${descending ? 'DESC' : ''}`} LIMIT ${limit} OFFSET ${skip}`;
		let result;
		try {
			result = await pool.query(query, vars);
		} catch (err) {
			console.error(query);
			console.error(err);
			if (err.message.includes('canceling statement due to statement timeout')) {
				res.statusCode = 503;
				res.end(JSON.stringify({ error: 'Query timeout' }));
			} else {
				res.statusCode = 500;
				res.end(JSON.stringify({ error: 'Error constructing query' }));
			}
			return;
		}

		res.end(JSON.stringify({
			data: result.rows.map(a => {
				let data = {
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
				};
				if (includePlayers) data.playerHistory = a.playerhistory;
				if (ipType == 'decimal') {
					let buf = Buffer.alloc(4);
					buf.writeUint32BE(data.ip);
					data.ip = Array.from(buf).map(a => a.toString()).join('.');
				}
				return data;
			}),
			credits: Math.max(0, config.maxCredits - requests[userIp])
		}));
	}

	if (endpoint == 'count') {
		if (!config.exclude.includes(userIp)) {
			if (requests[userIp] >= config.maxCredits) {
				res.statusCode = 429;
				res.end(JSON.stringify({ error: `Too many requests (Limit: ${config.maxCredits.toLocaleString()} credits per hour)` }));
				return;
			}
			if (requests[userIp] + limit > config.maxCredits) limit = Math.max(0, config.maxCredits - requests[userIp]);
			if (rateLimit) requests[userIp] += 100;
		}
		
		let cteServers = `WITH servers AS (SELECT DISTINCT ON (p.serverId) s.* FROM playerhistory p JOIN servers s ON s.serverId = p.serverId WHERE ${cteConditions.map(a => `(${a})`).join(' AND ')})`;
		let where = conditions.length == 0 ? '' : `WHERE ${conditions.map(a => `(${a})`).join(' AND ')}`;
		let query = `${cteConditions.length > 0 ? cteServers : ''} SELECT COUNT(*) FROM servers s ${where}`;
		let result;
		try {
			result = await pool.query(query, vars);
		} catch (err) {
			console.error(query)
			console.error(err);
			if (err.message.includes('canceling statement due to statement timeout')) {
				res.statusCode = 503;
				res.end(JSON.stringify({ error: 'Query timeout' }));
			} else {
				res.statusCode = 500;
				res.end(JSON.stringify({ error: 'Error constructing query' }));
			}
			return;
		}

		res.end(JSON.stringify({
			data: parseInt(result.rows[0].count),
			credits: Math.max(0, config.maxCredits - requests[userIp])
		}));
	}

	if (endpoint == 'bedrockServers') {
		if (!config.exclude.includes(userIp)) {
			if (requests[userIp] >= config.maxCredits) {
				res.statusCode = 429;
				res.end(JSON.stringify({ error: `Too many requests (Limit: ${config.maxCredits.toLocaleString()} credits per hour)` }));
				return;
			}
			if (requests[userIp] + limit > config.maxCredits) limit = Math.max(0, config.maxCredits - requests[userIp]);
			if (rateLimit) requests[userIp] += Math.max(10, limit);
		}
		
		let query = `SELECT * FROM bedrock b ${conditions.length > 0 ? 'WHERE' : ''} ${conditions.map(a => `(${a})`).join(' AND ')} ${sort == null ? '' : `ORDER BY ${sort} ${descending ? 'DESC' : ''}`} LIMIT ${limit} OFFSET ${skip}`
		let result;
		try {
			result = await pool.query(query, vars);
		} catch (err) {
			console.error(query);
			console.error(err);
			if (err.message.includes('canceling statement due to statement timeout')) {
				res.statusCode = 503;
				res.end(JSON.stringify({ error: 'Query timeout' }));
			} else {
				res.statusCode = 500;
				res.end(JSON.stringify({ error: 'Error constructing query' }));
			}
			return;
		}

		res.end(JSON.stringify({
			data: result.rows.map(a => {
				let data = {
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
				if (ipType == 'decimal') {
					let buf = Buffer.alloc(4);
					buf.writeUint32BE(data.ip);
					data.ip = Array.from(buf).map(a => a.toString()).join('.');
				}
				return data;
			}),
			credits: Math.max(0, config.maxCredits - requests[userIp])
		}));
	}

	if (endpoint == 'bedrockCount') {
		if (!config.exclude.includes(userIp)) {
			if (requests[userIp] >= config.maxCredits) {
				res.statusCode = 429;
				res.end(JSON.stringify({ error: `Too many requests (Limit: ${config.maxCredits.toLocaleString()} credits per hour)` }));
				return;
			}
			if (requests[userIp] + limit > config.maxCredits) limit = Math.max(0, config.maxCredits - requests[userIp]);
			if (rateLimit) requests[userIp] += 100;
		}
		
		let query = `SELECT COUNT(*) FROM bedrock b ${conditions.length > 0 ? 'WHERE' : ''} ${conditions.map(a => `(${a})`).join(' AND ')}`;
		let result;
		try {
			result = await pool.query(query, vars);
		} catch (err) {
			console.error(query)
			console.error(err);
			if (err.message.includes('canceling statement due to statement timeout')) {
				res.statusCode = 503;
				res.end(JSON.stringify({ error: 'Query timeout' }));
			} else {
				res.statusCode = 500;
				res.end(JSON.stringify({ error: 'Error constructing query' }));
			}
			return;
		}

		res.end(JSON.stringify({
			data: parseInt(result.rows[0].count),
			credits: Math.max(0, config.maxCredits - requests[userIp])
		}));
	}
}
