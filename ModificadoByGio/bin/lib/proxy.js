/*
Importa 3 clases : Conección , RealClient y Protocol
Importa 2 string de configuracion del JSON : region y cacheModulos
Importa 1 lista con datos : todas las regiones en la que funciona este proxy
*/
const { Connection, RealClient } = require('tera-proxy-game'),
	{ protocol } = require('tera-data-parser'),
	{ region: REGION, cacheModules } = require('../config.json'),
	REGIONS = require('./regions'),
/*
En currentRegion pongo de la lista de regiones la region que saque del JSON 
*/
	currentRegion = REGIONS[REGION]

/*
Solo chekea que la region sea distinta de null
*/
if(!currentRegion) {
	console.error('Unsupported region: ' + REGION)
	return
}

/*
Importo librerias standar de Node.js :
	-fs (Archivos lectura y escritura)
	-net (Sockets)
	-path ( Manipular path de archivos)
	-dns ( Manipular ip de dns )
  Importo host ( Importa funciones de host )
*/
const fs = require('fs'),
	net = require('net'),
	path = require('path'),
	dns = require('dns'),
	hosts = require('./hosts'),
/*
De la currentRegion extraigo 3 cosas :
	- customServers, listenHostname(ip de donde escucho) y hostname 
	En custom server estan los servidores truchos que salen en la lista de servidores
	como kaiator[Proxy] o velika [Proxy]
*/
	{ customServers, listenHostname, hostname } = currentRegion

/*
 Test if we're allowed to modify the hosts file
 Intento usar la funcion de host.remove y le paso:
 - listenHostname= 127.0.0.x 
 - hostname ='sls.service.enmasse.com' 
 Por ejemplo
*/
try { hosts.remove(listenHostname, hostname) }
catch(e) {
	/*
	 * Tipor de errores que puedo tener
	*/
	switch(e.code) {
		case 'EACCES':
			console.error(`ERROR: Hosts file is set to read-only.

* Make sure no anti-virus software is running.
* Locate "${e.path}", right click the file, click 'Properties', uncheck 'Read-only' then click 'OK'.`)
			break
		case 'EPERM':
			console.error(`ERROR: Insufficient permission to modify hosts file.

* Make sure no anti-virus software is running.
* Right click TeraProxy.bat and select 'Run as administrator'.`)
			break
		default:
			throw e
	}
	/*
	 *Termina la ejecucion
	*/
	process.exit(1)
}
/*
__dirname es el nombre del directorio del modulo actual:
console.log(__dirname);
// Prints: /Users/mjr
console.log(path.dirname(__filename));
// Prints: /Users/mjr

pone en moduleBase : C:\Users\GiovaOooO\Desktop\TERA-Proxy\ProxyNoAutomatico\tera-proxy\bin\node_modules
*/
const moduleBase = path.join(__dirname, '..', 'node_modules')

//Crea una variable llamada modules
let modules

function populateModulesList() {
	if(modules && cacheModules) return

	modules = []

	for(let name of fs.readdirSync(moduleBase))
		if(name[0] !== '.' && name[0] !== '_' && checkMod(name, path.join(moduleBase, name))) modules.push(name)
}

function checkMod(modName, file) {
	if(!fs.lstatSync(file).isDirectory()) return true // Standalone script

	try {
		const {packets} = JSON.parse(fs.readFileSync(path.join(file, 'mod.json'), 'utf8'))

		if(packets) {
			if(!protocol.loaded) protocol.load()

			for(let name in packets) {
				const msg = protocol.messages.get(name)

				if(!msg) {
					console.warn(`Failed to load mod "${modName}":\n* Packet "${name}" has no definition. (outdated proxy/mod?)`)
					return false
				}

				const versions = packets[name]

				for(let version of (typeof versions === 'number' ? [versions] : versions))
					if(!msg.get(version)) {
						console.warn(`Failed to load mod "${modName}":\n* Packet definition ${name}.${version} ${
							Math.max(...msg.keys()) > version ? 'is obsolete. (outdated mod)' : 'does not exist. (outdated proxy?)'
						}`)
						return false
					}
			}
		}
	}
	catch(e) {}

	return true
}

/**
 * Exporta una clase definida en ese modulo llamada SlsProxy
 */
const SlsProxy = require('tera-proxy-sls')

/**
 * Los Map son como diccionarios que tienen Clave: Valor
 */
const servers = new Map(),
/**
 * Crea un proxy con los datos dados por la region que elegi
 */
	proxy = new SlsProxy(currentRegion)

function clearUserModules(children) {
	const childModules = Object.create(null)
	let doChildModules
	const cache = children || require.cache
	let keys = Object.keys(cache), i = keys.length
	while(~--i) {
		const key = keys[i], _module = cache[key]
		if(!key.startsWith(moduleBase)) {
			const { parent } = _module
			if(parent && String(parent.id).startsWith(moduleBase)) {
				_module.parent = void 0
			}
			continue
		}
		const arr = _module.children
		if(arr && arr.length) {
			doChildModules = true
			for(let i = 0, len = arr.length; i < len; ++i) {
				const child = arr[i]
				const id = child.id
				childModules[id] = child
			}
		}
		delete cache[key]
	}
	return doChildModules ?
		clearUserModules(childModules) :
		void 0
}

/**
 * Pone un servidor de dns en este ejemplo es el de google
 */
dns.setServers(['8.8.8.8', '8.8.4.4'])

async function init() {
	console.log(`[proxy] initializing, game region: ${REGION}`)

	if(['NA', 'TW', 'JP', 'TH', 'KR', 'KR-TEST'].includes(REGION)) require('./xigncode-bypass')()

	// Retrieve server list
	/**
	 * Recupera la lista de servers , VER COMO hace ??
	 * En serverList esta la lista posta de servidores del juego! con su id
	 * El operador await es usado para esperar a una Promise. Sólo puede ser usado dentro de una función async 
	 */
	const serverList = await new Promise((resolve, reject) => {
		proxy.fetch((e, list) => { e ? reject(e) : resolve(list) }) // a fetch se paso una funcion
	})
	//console.log(serverList);
	// Create game proxies for specified servers
	/**
	 * Son  servers personalisados  tengo datos como este:
	 * 	tag , 4105 , 4107 cosas asi si lo recorre por id seran 3 recorridas 
	 * yo haria un tag menos llamativo
	 */
	
	for(let id in customServers) {
		//console.log(id);
		/**isNaN pone true si no es un numero */
		if(isNaN(id)) continue

		/**target sera : 4105 o 4107 */
		const target = serverList[id]

	/*	console.log("Customservers vale :");
		console.log(customServers);

		console.log("Target vale :");
		console.log(target);*/

		if(!target) {
			console.error(`server ${id} not found`)
			continue
		}
	
		/**
		 * Creo un socket llamado server
		 * Creo un servidor al cual se va a conectar el tera (Este es el que aparece en la lista
		 * como un tal Mount tyrannas (Proxy))
		 * NO CREA PASA DE esta linea es decir hace esta linea y sigue de largo esperando
		 * el callback function  , hasta que se conecte un cliente real del tera
		 */
		
		const server = net.createServer(socket => {
			/**
			 * Cuando entro al tera (Entro al servidor que aparece en la lista) el socket se crea
			 * con estos datos:
			 * ip = 127.0.0.1
			 * port = 53081
			 * son datos q aparecen pero aun no hubo coneccion
			 */
			
			 /**
			  * Es solo un log para ver por consola
			  */
			const logTag = `[game][${socket.remoteAddress}:${socket.remotePort}]`

			function log(msg) { console.log(logTag, msg) }

			socket.setNoDelay(true)

			/**
			 * Aca creo un objeto Connection por primera vez
			 * y el objeto clienteReal
			 * socket es del servidor Proxy
			 */
			const connection = new Connection(),
				client = new RealClient(connection, socket),
				/**
				 * Paso los ip y puerto DEL PROXY y el cliente para conectarse
				 * No digo q conecto al cliente con el real digo q le paso los dos
				 */

				 /**Declaro srvConn por primera vez aver que hace! la ip y puerto son de los 
				  * servidores originales 	
				  * Pareciera que quiero conectar al cliente con IP/Puerto reales del juego
				 */
				srvConn = connection.connect(client, { host: target.ip, port: target.port })

			populateModulesList()

			log('connecting')

			connection.dispatch.once('init', () => {
				for(let name of modules) connection.dispatch.load(name, module)
			})

			socket.on('error', err => {
				if(err.code === 'ECONNRESET') log('lost connection to client')
				else console.warn(logTag, err)
			})

			srvConn.on('connect', () => {
				log(`connected to ${srvConn.remoteAddress}:${srvConn.remotePort}`)
			})

			srvConn.on('error', err => {
				if(err.code === 'ECONNRESET') log('lost connection to server')
				else console.warn(logTag, err)
			})

			srvConn.on('close', () => {
				log('disconnected')

				if(!cacheModules) {
					console.log('[proxy] unloading user mods')
					clearUserModules()
				}
			})
		})

		servers.set(id, server)
	}

	// Run SLS proxy
	try {
		await new Promise((resolve, reject) => {
			proxy.listen(listenHostname, e => { e ? reject(e) : resolve() })
		})
	}
	catch(e) {
		if(e.code === 'EADDRINUSE') {
			console.error('ERROR: Another instance of TeraProxy is already running, please close it then try again.')
			process.exit()
		}
		else if(e.code === 'EACCES') {
			let port = currentRegion.port
			console.error(`ERROR: Another process is already using port ${port}.\nPlease close or uninstall the application first:\n${require('./netstat')(port)}`)
			process.exit()
		}
		throw e
	}
	console.log(`[sls] listening on ${listenHostname}:${currentRegion.port}`)

	hosts.set(listenHostname, hostname)
	console.log('[sls] added hosts file entry')

	// Run game proxies
	const gameProxyQ = []

	for(let [id, server] of servers)
		gameProxyQ.push(new Promise((resolve, reject) => {
			server.listen(customServers[id].port, customServers[id].ip || '127.0.0.1', resolve)
			.on('error', reject)
		}).then(() => {
			const address = server.address()
			console.log(`[game] listening on ${address.address}:${address.port}`)
		}))

	try {
		await Promise.all(gameProxyQ)
		console.log('[proxy] OK')
	}
	catch(e) {
		if(e.code === 'EACCES') {
			let port = currentRegion.port
			console.error(`ERROR: Another process is already using port ${port}.\nPlease close or uninstall the application first:`)
			return require('./netstat')(port)
		}
		throw e
	}
}

init()

function cleanExit() {
	console.log('terminating...')

	try { hosts.remove(listenHostname, hostname) }
	catch(_) {}

	proxy.close()
	for(let server of servers.values()) server.close()

	process.exit()
}

process.on('SIGHUP', cleanExit)
process.on('SIGINT', cleanExit)
process.on('SIGTERM', cleanExit)