import lex from './lexer.js';
import parse from './parser.js';
import transpileAst from './transpiler.js';

function transpile(code) {
	const tokens = lex(code);
	const statements = parse(tokens);
	const jsCode = transpileAst(statements);
	return jsCode;
}
function run(code) {
	const jsCode = transpile(code);
	return eval(jsCode);
}
export { transpile, run };
