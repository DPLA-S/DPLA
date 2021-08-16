(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.DPLA = {}));
}(this, (function (exports) { 'use strict';

	function error(line, msg) {
		const err = new Error(`[line ${line}] ${msg}`);
		err.name = 'DPLAError';
		throw err;
	}

	const reserved = [
		'Event',

		'If', 'Else', 'Elif',

		'function', 'return',

		'For', 'in'
	].reduce((res, curr) => {
		res[curr] = curr.toUpperCase();
		return res;
	}, {});
	function lex(code) {
		const tokens = [];
		let index = 0, line = 1;
		const advance = (times = 1) => {
			index += times;
			return code[index];
		};
		const next = (times = 1) => code[index + times];
		const peek = () => code[index];
		const isEnd = () => !(index < code.length);
		const isEOL = () => next() === '\n';
		function addToken(type, value = type) {
			tokens.push({ type, value, line });
		}
		function match(nextToken) {
			if (next() !== nextToken)
				return false;
			advance();
			return true;
		}
		for (; index < code.length; advance()) {
			const isAlpha = str => /[a-zA-Z]+/.test(str);
			const isNum = str => /\d+/.test(str);
			const isAlphaNum = str => /[a-zA-Z0-9]/.test(str);
			if (isNum(peek())) {
				let number = peek();
				while (isNum(next()) && !isEOL()) {
					advance();
					number += peek();
					if (next() === '.') {
						advance();
						number += peek();
						while (isNum(next()) && !isEOL()) {
							advance();
							number += peek();
						}
					}
				}
				addToken('NUMBER', Number(number));
			} else if (isAlpha(peek()) || peek() === '_') {
				let text = peek();
				while ((isAlphaNum(next()) || next() === '_') && !isEOL()) {
					advance();
					text += peek();
				}
				if (text in reserved) addToken(reserved[text], text);
				else addToken('IDENTIFIER', text);
			} else {
				switch (peek()) {
					case '\n': line += 1; break;
					case ' ': case '\r': case '\t': break;
					case '[': addToken('OPEN_SQUARE'); break;
					case ']': addToken('CLOSE_SQUARE'); break;
					//case ':': addToken('COLON'); break;
					case '+': addToken('PLUS'); break;
					case '-': addToken('MINUS'); break;
					case '*': addToken('TIMES'); break;
					case '/': addToken('DIVIDE'); break;
					case '(': addToken('OPEN_PAREN'); break;
					case ')': addToken('CLOSE_PAREN'); break;
					case ',': addToken('COMMA'); break;
					case '=':
						if (match('=')) addToken('EQUALS_EQUALS');
						else if (match('!')) addToken('EQUALS_BANG');
						else addToken('EQUALS');
						break;
					case '&':
						if (match('&')) {
							while (next() != '\n' && !isEnd()) advance();
						}
						break;
					case '#':
						if (match('&')) {
							while (!isEnd() && !(next() === '&' && next(2) === '#')) {
								advance();
								if (peek() === '\n') line += 1;
							}
							if (next() !== '&' && next(2) !== '#')
								error(line, 'Unterminated multiline comment');
							advance(2);
						}
						break;
					case '"':
					case "'":
						const quote = peek();
						let string = '';
						while (next() !== quote && !isEOL()) {
							advance();
							if (next() === '\\') {
								string += peek();
								switch (next(2)) {
									case 'n': string += '\n'; break;
									case 'r': string += '\r'; break;
									case 't': string += '\t'; break;
									case '\\': string += '\\'; break;
									case '"': string += '"'; break;
									case "'": string += "'"; break;
									default: error(line, 'Invalid escape sequence \\' + next());
								}
								advance(2);
							} else {
								string += peek();
							}
						}
						if (next() !== quote)
							error(line, 'Unterminated string literal');
						advance();
						addToken('STRING', string);
						break;
					default:
						error(line, 'Unexpected character ' + peek());
				}
			}
		}
		addToken('EOF');
		return tokens;
	}

	function parse(tokens) {
		let index = 0;
		const peek = () => tokens[index] || {};
		const advance = () => tokens[++index];
		const previous = () => tokens[index - 1];
		const isAtEnd = () => peek().type === 'EOF';
		const check = type => !isAtEnd() && peek().type == type;
		function consume(type, expect) {
			if (peek().type !== type) error(peek().line, expect);
			return advance();
		}
		function match(...types) {
			for (const type of types) {
				if (check(type)) {
					advance();
					return true;
				}
			}
			return false;
		}
		function primaryExpression() {
			if (match("NUMBER", "STRING")) return {type: 'literal', value: previous().value, line: previous().line};
			if (match("OPEN_PAREN")) {
				const expr = expression();
				consume('CLOSE_PAREN', 'Expected closing parenthesis');
				return expr;
			}
			if (match("IDENTIFIER")) return {type: 'identifier', name: previous().value, line: previous().line};
			error(peek().line, 'Unexpected token ' + peek().value);
		}
		function call() {
			let expr = primaryExpression();
			if (match('OPEN_SQUARE')) {
				const args = [];
				do {
					if (check('CLOSE_SQUARE')) break;
					args.push(expression());
				} while (match('COMMA'));
				consume('CLOSE_SQUARE', 'Expected closing square bracket');
				expr = {type: 'funccall', args, name: expr.name, line: expr.line};
			}
			return expr;
		}
		function multiplication() {
			let expr = call();
			while(match('TIMES', 'DIVIDE')) {
				const operator = previous().value;
				const right = primaryExpression();
				expr = {type: 'binary', operator, left: expr, right, line: expr.line};
			}
			return expr;
		}
		function addition() {
			let expr = multiplication();
			while(match('PLUS', 'MINUS')) {
				const operator = previous().value;
				const right = multiplication();
				expr = {type: 'binary', operator, left: expr, right, line: expr.line};
			}
			return expr;
		}
		function equality() {
			let expr = addition();
			while (match('EQUALS_EQUALS', 'EQUALS_BANG')) {
				const operator = previous().value;
				const right = addition();
				expr = {type: 'binary', operator, left: expr, right, line: expr.line};
			}
			return expr;
		}
		function assignment() {
			const expr = equality();
			if (match('EQUALS')) {
				if (expr.type !== 'identifier')
					error(expr.line, 'Expected identifier but instead got ' + expr.type);
				const value = expression();
				return {type: 'assignment', name: expr.name, value, line: expr.line};
			}
			return expr;
		}
		function expression() {
			// assignment => equality => addition => multiplication => call => primary
			return assignment();
		}
		function block() {
			const statements = [];
			while (!check('CLOSE_PAREN')) {
				statements.push(declaration());
			}
			consume('CLOSE_PAREN', 'Expect closing parenthesis after block');
			return statements;
		}
		function functionDeclaration() {
			const line = peek().line;
			consume('IDENTIFIER', 'Expect identifier');
			const name = previous().value;
			consume('OPEN_SQUARE', 'Expect opening square bracket');
			const args = [];
			do {
				if (check('CLOSE_SQUARE')) break;
				args.push(expression());
			} while (match('COMMA'));
			consume('CLOSE_SQUARE', 'Expect closing square bracket');
			consume('OPEN_PAREN', 'Expect opening parenthesis');
			const body = block();
			return {type: 'funcdef', name, line, args, body};	
		}
		function declaration() {
			if(match("FUNCTION")) return functionDeclaration();
			return statement();
		}
		function eventStatement() {
			const line = previous().line;
			consume('OPEN_SQUARE', 'Expect opening square bracket before event type');
			consume('IDENTIFIER', 'Expect event type');
			const eventType = previous().value;
			consume('CLOSE_SQUARE', 'Expect closing square bracket');
			consume('OPEN_PAREN', 'Expect opening parenthesis before event handler');
			const body = block();
			return {type: 'eventhandler', eventType, body, line};
		}
		function ifStatement() {
			const line = previous().line;
			consume('OPEN_SQUARE', 'Expect opening square bracket');
			const condition = expression();
			consume('CLOSE_SQUARE', 'Expect closing square bracket');
			consume('OPEN_PAREN', 'Expect opening parenthesis before if statement block');
			const body = block();
			const elifs = new Map();
			while (match('ELIF')) {
				consume('OPEN_SQUARE', 'Expect opening square bracket');
				const elifCond = expression();
				consume('CLOSE_SQUARE', 'Expect closing square bracket after condition');
				consume('OPEN_PAREN', 'Expect opening parenthesis before block');
				const elifBody = block();
				elifs.set(elifCond, elifBody);
			}
			let elseBlock = [];
			if (match('ELSE')) {
				consume('OPEN_PAREN', 'Expect opening parenthesis after else');
				elseBlock = block();
				consume('CLOSE_PAREN', 'Expect closing parenthesis after block');
			}
			return {type: 'if', condition, body, elifs, elseBlock, line};
		}
		function forStatement() {
			const line = previous().line;
			consume('IDENTIFIER', 'Expect variable name');
			const variable = previous().value;
			consume('IN', 'Expect keyword in');
			const iterable = expression();
			consume('OPEN_PAREN', 'Expect opening parenthesis before loop body');
			const body = block();
			return {type: 'for', line, body, iterable, variable};
		}
		function statement() {
			if (match('EVENT')) return eventStatement();
			if (match('IF')) return ifStatement();
			if (match('FOR')) return forStatement();
			if (match("RETURN")) return {type: 'return', line: previous().line, value: expression()};
			return expression();
		}
		const statements = [];
		while(!isAtEnd()) {
			statements.push(declaration());
		} 
		return statements;
	}

	const stdlib = `//DPLA stdlib -----------
function print(object) {
	console.log(object);
}
function command_print(object) {
	console.log(object);
}
function lang(language) {
	window.__LANG__ = language;
}
function input(msg) {
	return window.prompt(msg)
}
function int(val) {
	const res = Number(val);
	if (!Number.isInteger(res)) throw new Error('Cannot convert ' + val + ' to integer');
	return res; 
}
function range(end) {
	return Array(end).fill(null).map((t,i)=>i);
}
window.__eventListeners__ = {};
function __emitEvent__(type) {
	if (__eventListeners__[type] instanceof Array)
		__eventListeners__[type].forEach(listener => listener());
}
function __addListener__(type, callback) {
	if(!(__eventListeners__[type] instanceof Array))
		__eventListeners__[type] = [];
	__eventListeners__[type].push(callback);
}
window.addEventListener("load", function(e) {
	__emitEvent__('onLaunch');
});
window.addEventListener('keydown', function(e) {
   __emitEvent__('keypress_' + e.key);
});
// ----------------- DPLA stdlib
`;
	function escapeString(str) {
		return str
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t')
		.replace(/'/g, "\\'")
		.replace(/"/g, '\\"');
	}
	function transpile$1(statements, isFinalProgram = true) {
		function block(stmts, indent = 2) {
			return transpile$1(stmts, false).split('\n').map(item => ' '.repeat(indent) + item).join('\n');
		}
		function transpileDeclaration(decl) {
			if (!decl) return '';
			if (decl.type === 'funcdef') return `function ${decl.name}(${decl.args.map(item => transpileExpr(item)).join(' ')}) {
${block(decl.body)}
}`;
			return transpileStatement(decl);
		}
		function transpileStatement(stmt) {
			if (!stmt) return '';
			switch (stmt.type) {
				case 'eventhandler':
					return `__addListener__('${stmt.eventType}', function() {
${block(stmt.body)}
});`;
				case 'if':
					let elifs = '';
					stmt.elifs.forEach((elifBlock, cond) => {
						elifs += ` else if (${transpileExpr(cond)}) {
${block(elifBlock)}
}`;
					});
					return `if (${transpileExpr(stmt.condition)}) {
${block(stmt.body)}
} ${elifs}${stmt.elseBlock.length > 0 ? ` else {
${block(stmt.elseBlock)}
}` : ''}`;
				case 'for':
					let iterable = transpileExpr(stmt.iterable);
					return `for (let ${stmt.variable} of ${iterable}) {
${block(stmt.body)}
}`;
				case 'return':
					return `return ${transpileExpr(stmt.value)};`;
			}
			return transpileExpr(stmt);
		}
		function transpileExpr(expr) {
			if (!expr) return '';
			switch (expr.type) {
				case 'literal': return typeof expr.value === 'string' ? `"${escapeString(expr.value)}"` : expr.value;
				case 'identifier': return expr.name;
				case 'binary': 
					const left = transpileExpr(expr.left);
					const right = transpileExpr(expr.right);
					switch(expr.operator) {
						case 'PLUS': return `(${left} + ${right})`;
						case 'MINUS': return `(${left} - ${right})`;
						case 'TIMES': return `(${left} * ${right})`;
						case 'DIVIDE': return `(${left} / ${right})`;
						case 'EQUALS_EQUALS': return `${left} === ${right}`;
						case 'EQUALS_BANG': return `${left} !== ${right}`;
					}
				case 'funccall':
					return `${expr.name}(${expr.args.map(arg => transpileExpr(arg)).join(', ')})`;
				case 'assignment':
					return `var ${expr.name} = ${transpileExpr(expr.value)}`;
			}
		}
		let res = isFinalProgram ? stdlib : '';
		for (const stmt of statements) {
			res += transpileDeclaration(stmt) + '\n';
		}
		return res;
	}

	function transpile(code) {
		const tokens = lex(code);
		const statements = parse(tokens);
		const jsCode = transpile$1(statements);
		return jsCode;
	}
	function run(code, scope = {}) {
		const jsCode = transpile(code);
		const func = new Function(...Object.keys(scope), jsCode);
		func(...Object.values(scope));
	}

	exports.run = run;
	exports.transpile = transpile;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
