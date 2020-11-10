export function logExceptions(): MethodDecorator {
	return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): TypedPropertyDescriptor<any> {
		return {
			value: function () {
				try {
					return descriptor.value.apply(this, arguments);
				} catch (e) {
					console.error(e);
					throw e;
				}
			}
		};
	};
}
export function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
export function compute_line_width(resolution) {
	return Math.min(40, Math.max(5, 40 / resolution)) / 3;
}