'use strict';
let ssmd = require('..');
let t = require('tape');

function deepClone(tree) {
	return JSON.parse(JSON.stringify(tree));
}

t('mergeTree', (t) => {
	// No conflicts - simple scenarios
	let root = {
		id: "oldRoot",
		children: []
	};
	let tree = {
		id: 'newRoot',
		children: [
			{
				id: 'foo',
				children: [
					{ id: 'child1 of foo' },
					{ id: 'child2 of foo' },
				]
			}
		]
	};

	let r = deepClone(root);
	ssmd.mergeTree(r, tree);
	console.log(JSON.stringify(r, null, 3));

	// Some actual merges
	root = {
		id: "oldRoot",
		children: [
			{
				id: "thing",
				children: [
					{ id: "old thing child 1" },
					{ id: "old thing child 2" },
				]
			}
		]
	};
	tree = {
		id: 'newRoot',
		children: [
			{
				id: 'thing',
				children: [
					{ id: 'new child1', name: 'nom' },
					{
						id: 'new child2',
						children: [
							{ id: '3 gen' }
						]
					},
				]
			}
		]
	};

	r = deepClone(root);
	ssmd.mergeTree(r, tree);
	console.log(JSON.stringify(r, null, 3));

	t.end();
});

