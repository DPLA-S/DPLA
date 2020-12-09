import error from './error.js';
const reserved = [
	'Event',

	'If', 'Else', 'Elif',

	'function', 'return',

	'For', 'in'
].reduce((res, curr) => {
	res[curr] = curr.toUpperCase();
	return res;
}, {});
export default function lex(code) {
	const tokens = [];
	let token = '';
	let index = 0, line = 1;
	const advance = (times = 1) => {
		index += times;
		return code[index];
	};
	const next = (times = 1) => code[index + times];
	const peek = () => code[index];
	const isEnd = () => index < code.length;
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
					if (match('#')) {
						while (!isEnd() && !(next() == '#' && next(2) !== '&')) {
							advance();
							if (peek() === '\n') line += 1;
						}
						if (next() !== '#' && next(2) !== '&')
							error(line, 'Unterminated multiline comment');
						line += 2;
					}
					break;
				case '"':
				case "'":
					const quote = peek();
					let string = '';
					while (next() !== quote && !isEOL()) {
						advance();
						if (next() === '\\') {
							switch (next(2)) {
								case 'n': string += '\n'; break;
								case 'r': string += '\r'; break;
								case 't': string += '\t'; break;
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
