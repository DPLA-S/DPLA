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
	if (!Number.isInteger(res)) throw new Error('Cannot convert ' + val + 'to integer');
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
	.replace(/\n/g, '\\n')
	.replace(/\r/g, '\\r')
	.replace(/\t/g, '\\t')
	.replace(/'/g, "\\'")
	.replace(/"/g, '\\"');
}
export default function transpile(statements, isFinalProgram = true) {
	function block(stmts, indent = 2) {
		return transpile(stmts, false).split('\n').map(item => ' '.repeat(indent) + item).join('\n');
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
				return `var ${name} = ${transpileExpr(value)}`;
		}
	}
	let res = isFinalProgram ? stdlib : '';
	for (const stmt of statements) {
		res += transpileDeclaration(stmt) + '\n';
	}
	return res;
}
