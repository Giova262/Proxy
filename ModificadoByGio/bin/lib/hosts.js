// windows-only, synchronous version of `hostile` with slight modifications
var fs = require('fs');
var path = require('path');

/**
 * Con el objeto path.join armo la ruta de donde esta mi archivo host que es :
 * 	c:/windows/system32/etc/hosts
 * Con esa ruta voy a abrir ese archivo y le voy a agregar una ip con su nombre
 */
var HOSTS = path.join(
	process.env.SystemRoot || path.join(process.env.SystemDrive || 'C:', 'Windows'),
	'/System32/drivers/etc/hosts'
);

exports.get = function () {
	var lines = [];
	try {
		//Abre el archivo que esta en HOSTS con el codigo utf8
		fs.readFileSync(HOSTS, {encoding: 'utf8'})
		.replace(/\r?\n$/, '')
		.split(/\r?\n/)
		.forEach(function (line) { //Para cada elemento spliteado hace esta acción
			/* Matchea si la linea hay algo raro pero suele dar null al iniciar*/
			var matches = /^\s*?([^#]+?)\s+([^#]+?)$/.exec(line);
			//console.log(matches);
			if (matches && matches.length === 3) {
				// Found a hosts entry
				/**
				 * pone la ip + hostname en lines
				 */
				var ip = matches[1];
				var host = matches[2];
				lines.push([ip, host]);
			} else {
				// Found a comment, blank line, or something else
				lines.push(line);
			}
		});
	} catch (e) {
		// ENOENT: File doesn't exist (equivalent to empty file)
		// Otherwise, throw
		if (e.code !== 'ENOENT') {
			throw e;
		}
	}
	/*En lines pongo basicamente en cada elemento una linea util del archivo host */
	return lines;
};

exports.set = function (ip, host) {
	/*
	Llama a la funcion de arriba
	*/
	var lines = exports.get();

	// Try to update entry, if host already exists in file
	var didUpdate = false;
	lines = lines.map(function (line) {
		if (Array.isArray(line) && line[1] === host) {
			line[0] = ip;
			didUpdate = true;
		}
		return line;
	});

	// If entry did not exist, let's add it
	if (!didUpdate) {
		lines.push([ip, host]);
	}

	exports.writeFile(lines);
};

exports.remove = function (ip, host) {
	/*
	Llama a la funcion de arriba , que llena lines con los contenidos del archivos
	host que esta en mi maquina
	*/
	var lines = exports.get();

	// Try to remove entry, if it exists
	lines = lines.filter(function (line) {
		return !(Array.isArray(line) && line[0] === ip && line[1] === host);
	});

	/**
	 * Llama a escribir 
	 */
	exports.writeFile(lines);
};

exports.writeFile = function (lines) {
	var data = '';

	/**
	 * Pone en data lo que parseo antes de la misma manera
	 */
	lines.forEach(function (line) {
		if (Array.isArray(line)) {
			line = line[0] + ' ' + line[1];
		}
		data += line + '\r\n';
	});

	// Get mode (or set to rw-rw-rw-); check read-only
	var mode;
	try {
		mode = fs.statSync(HOSTS).mode;
		if (!(mode & 128)) { // 0200 (owner, write)
			// FIXME generate fake EACCES
			var err = new Error('EACCES: Permission denied');
			err.code = 'EACCES';
			err.path = HOSTS;
			throw err;
		}
	} catch (e) {
		if (e.code === 'ENOENT') {
			mode = 33206; // 0100666 (regular file, rw-rw-rw-)
		} else {
			throw e;
		}
	}

	// Write file
	fs.writeFileSync(HOSTS, data, {mode: mode});
};
