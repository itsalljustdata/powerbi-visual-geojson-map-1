export class Fetch_Queue {

	queue = [];
    size:Number;

	constructor(size) {
		if (size <= 0) {
			throw new Error("Fetch_Pool(size) size must be positive number");
		}
		this.size = size;
	}

	fetch(url) {
		let resolver;
		let np = new Promise((resolve, reject) => {
			resolver = resolve;
		});
		this.queue.push([url, resolver]);
		return np;
	}

	chunk(iter, n) {
        let result = [];
		let batch = [];
		for (let item of iter) {
			batch.push(item);
			if (batch.length > n-1) {
				result.push(batch)
				batch = [];
			}
		}
		if (batch) result.push(batch);
        return result;
	}

	all() {
		for (let batch of this.chunk(this.queue, 30)) {
			let promises = [];
			for (let [url, resolver] of batch) {
				promises.push(
					fetch(url).then(result => resolver(result))
				);
			}
			Promise.all(promises);
		}
		this.queue = [];
	}

}