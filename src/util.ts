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


export function compute_line_width(resolution_px_per_m, desired_weight_px) {
    // at roughly 3 px per meter we want to display the desired weight at a 1:1 ratio
	return Math.min(60, Math.max(1, desired_weight_px * Math.exp(-(resolution_px_per_m-4))));
}