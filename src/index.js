import lex from './lexer.js';
import parse from './parser.js';
import transpile from './transpiler.js';

const $ = selector => document.querySelector(selector);
HTMLElement.prototype.on = HTMLElement.prototype.addEventListener;

$('#run-btn').on('click', e => {
	const code = $('#code').value;
	const tokens = lex(code);
	const statements = parse(tokens);
	const jsCode = transpile(statements);
	$('#js-code').value = jsCode;
	eval(jsCode);
});