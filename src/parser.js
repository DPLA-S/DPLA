import error from './error.js'
export default function parse(tokens) {
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
		console.log(peek(), tokens);
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
			const operator = previous().value
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
			expr = {type: 'assignment', name: expr, value, line: expr.line};
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
		if (match("OPEN_PAREN")) return {type: 'block', line: previous().line, body: block()}
		return expression();
	}
	const statements = [];
	while(!isAtEnd()) {
		statements.push(declaration());
	} 
	return statements;
}
