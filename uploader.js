'use strict';

const s3 = require('s3');
const fs = require('fs');

class Uploader {
	// options: {
	//     s3: {
	//        accessKeyId: S3 access id
	//        secretAccessKey: S3 secret key
	//        bucket: Name of S3 bucket
	//        bucketRoot: Root of S3 bucket, into which we will upload
	//     },
	//     dist: Folder where content has been written into
	//     moduleName: For multi-repo setups, the name of this repo. Each repo name must be unique.
	// }
	constructor(options) {
		this.options = options;
		this.client = s3.createClient({
			s3Options: {
				accessKeyId: this.options.s3.accessKeyId,
				secretAccessKey: this.options.s3.secretAccessKey,
			}
		});
		this.dist = options.dist;
	}

	bucketPrefix() {
		return this.options.s3.bucketRoot;
	}

	moduleName() {
		return this.options.moduleName || '_simple';
	}

	s3Params() {
		return {
			Bucket: this.options.s3.bucket,
		}
	}

	// Download all manifests that are currently online, so that we can merge them together.
	async downloadAllManifests(tmpDir) {
		return new Promise((resolve, reject) => {
			let downloader = this.client.downloadDir({
				localDir: tmpDir + "/manifest",
				s3Params: Object.assign(this.s3Params(), {
					Prefix: this.bucketPrefix() + "manifest"
				})
			});
			downloader.on('end', resolve);
			downloader.on('error', reject);
		});
	}

	upload() {
		// recommended by s3 package, to improve speed
		//http.globalAgent.maxSockets = https.globalAgent.maxSockets = 20;

		// read the manifest for just this module
		this.manifest = JSON.parse(fs.readFileSync([this.dist, 'manifest', this.moduleName() + ".json"].join("/"), { encoding: "utf-8" }));

		this.deleteStaleContent(function () {
			this.uploadContent(null);
		}.bind(this));
	}

	treeToArray(root) {
		let list = [];
		let scan = function (node) {
			list.push(node);
			if (node.children) {
				for (let c of node.children)
					scan(c);
			}
		}
		scan(root);
		return list;
	}

	// Fetch the previous manifest of just this module, so that we can figure out which
	// files need to be deleted from S3
	deleteStaleContent(onfinish) {
		let prevKey = this.bucketPrefix() + 'manifest/' + this.moduleName() + ".json";
		let downloader = this.client.downloadBuffer(Object.assign(this.s3Params(), {
			Key: prevKey
		}));
		console.log("Fetching previous manifest from " + prevKey);

		let onJsonFetch = function (buf) {
			// Compare the previous manifest to the current one. Delete any files that were present in the
			// old manifest, but are no longer present in the current manifest.
			// Since we're only looking at the manifest of our own module, we won't delete
			// files that were uploaded by another module.
			let previous = JSON.parse(buf);

			let previousNodes = this.treeToArray(previous);
			let nextNodes = this.treeToArray(this.manifest);
			let nextNodesByPath = {};
			for (let n of nextNodes)
				nextNodesByPath[n.path] = n;
			let deleteList = [];
			let deleteListUI = [];
			for (let n of previousNodes) {
				if (nextNodesByPath[n.path] === undefined) {
					// this page has been deleted
					deleteListUI.push(this.bucketPrefix() + n.path);
					deleteList.push({
						Key: this.bucketPrefix() + n.path,
					});
				}
			}
			if (deleteListUI.length != 0) {
				console.info("Deleting " + deleteListUI.join(", "));
				let deleter = this.client.deleteObjects(Object.assign(this.s3Params(), {
					Delete: {
						Objects: deleteList
					}
				}));
				deleter.on('error', function (err) {
					console.error(" Error deleting old files: ", err);
				});
				deleter.on('end', function () {
					console.info(" Finished deleting old files ");
				});
			} else {
				console.info("Nothing to delete");
			}
			onfinish();
		}.bind(this);

		downloader.on('error', function (err) {
			if (err.message.indexOf("404") != -1) {
				// This is the first time that we're uploading, so no need to delete anything from S3
				console.log("No previous manifest found. This looks like the first time that we're uploading " + this.moduleName() + " to this bucket");
				onfinish();
			} else {
				console.log(JSON.stringify(err));
			}
		}.bind(this));
		downloader.on('end', function (buf) {
			onJsonFetch(buf);
		});
	}

	uploadContent(onfinish) {
		// Upload directory tree
		let uploader = this.client.uploadDir({
			localDir: this.dist,
			deleteRemoved: false, // we manually remove deleted, so that multiple repos can contribute to a single document store
			s3Params: Object.assign(this.s3Params(), {
				Prefix: this.bucketPrefix()
			})
		});
		this.setupS3Callbacks("Upload content", uploader, onfinish);
	}

	setupS3Callbacks(name, task, onfinish) {
		task.on('error', function (err) {
			console.error(err);
		});
		let lastUpdate = new Date();
		task.on('progress', function () {
			let now = new Date();
			if (now.getTime() - lastUpdate.getTime() >= 1000) {
				console.log(name + ": " + task.progressAmount + "/" + task.progressTotal);
				lastUpdate = now;
			}
		});
		task.on('end', function () {
			console.log(name + ": done");
			let url = this.options.s3.bucket + "/";
			if (this.bucketPrefix() != "")
				url += this.bucketPrefix();
			console.log("If you've configured DNS to point to your bucket,\nyou can view your docs at: http://" + url);
			if (onfinish)
				onfinish();
		}.bind(this));
	}
}

module.exports = Uploader
