export default function error(line, msg) {
	const err = new Error(`[line ${line}] ${msg}`);
	err.name = 'DPLAError';
	throw err;
}