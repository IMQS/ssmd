'use strict';
const fs = require('fs');
const marked = require('marked');
const uploader = require('./uploader')
const args = require('args');

let singleModule = '_single';

class Page {
	constructor() {
		this.path = [];
		this.children = [];
		this.name = "";
		this.markdown = "";
	}

	dump(depth) {
		for (let p of this.children.filter(c => c.children.length == 0)) {
			let s = "  ".repeat(depth);
			s += p.name;
			console.log(s);
		}
		for (let p of this.children.filter(c => c.children.length != 0)) {
			let s = "  ".repeat(depth);
			s += "[" + p.name + "]";
			console.log(s);
			p.dump(depth + 1);
		}
	}

	id() {
		return this.path.concat(this.name).join('-');
	}

	localUrl() {
		return this.path.concat(this.name + ".html").join('/');
	}

	// If this node has an 'index.md' child, then return that child. Otherwise, return null.
	indexChild() {
		for (let p of this.children) {
			if (p.isIndex())
				return p;
		}
		return null;
	}

	// If a page has a child called 'index', then copy it's contents up into the parent,
	// and delete that child. This makes further processing simpler.
	promoteIndex() {
		for (let i = 0; i < this.children.length; i++) {
			let c = this.children[i];
			c.promoteIndex();
			if (c.isIndex()) {
				if (this.markdown != "")
					throw "Page " + this.name + " already has content. Promoting 'index' up into it would destroy content";
				this.markdown = c.markdown;
				this.children.splice(i, 1);
				i--;
			}
		}
	}

	isIndex() {
		return this.name === 'index';
	}

	makeJSONPageTree() {
		let tree = {};
		let make = (page) => {
			let node = {
				id: page.id(),
				path: page.localUrl(),
				name: page.name,
				hasContent: page.markdown != "",
			};
			node.children = [];
			for (let c of page.children)
				node.children.push(make(c));
			return node;
		};
		return make(this);
	}
}

class PageBuilder {
	constructor() {
		this.frame = fs.readFileSync("themes/frame.html", { encoding: "utf-8" });
		this.page = fs.readFileSync("themes/page.html", { encoding: "utf-8" });
		this.indexJS = fs.readFileSync("themes/frame.js", { encoding: "utf-8" });
		this.indexCSS = null;
		this.pageCSS = null;
	}

	readTheme(themeName) {
		this.indexCSS = fs.readFileSync("themes/" + themeName + "/frame.css", { encoding: "utf-8" });
		this.pageCSS = fs.readFileSync("themes/" + themeName + "/page.css", { encoding: "utf-8" });
	}

	makePage(content) {
		let s = this.page.replace("/*PAGE_CSS*/", this.pageCSS);
		s = s.replace("<!-- PAGE BODY -->", content);
		return s;
	}

	firstPage(page) {
		if (page.hasContent)
			return page;
		if (!page.children)
			return null;
		for (let c of page.children) {
			let p = this.firstPage(c);
			if (p)
				return p;
		}
		return null;
	}

	// Create index.html, which is the outer page that the user navigates to.
	// The content lives inside an iframe, inside index.html
	makeIndexFrame(mergedManifestFile) {
		let indent = ' '.repeat(4);
		let makeHTML = (p, depth) => {
			let self = "";
			let indentDepth = indent.repeat(depth + 1);
			if (p.hasContent) {
				let title = p.name;
				let classes = 'indexItem';
				if (p.children && p.children.length == 0)
					classes += " liNone";
				self += indentDepth + `<li id='doc-${p.id}' class='${classes}' onclick='navigateToPage("${p.path}", "${p.id}")'>${title}</li>\n`;
			} else if (p.name !== "") {
				// This is just a category node, without any content. So this might be something like "API", or "Reference".
				self += indentDepth + `<li id='doc-${p.id}' class='indexItem' onclick='togglePageOpen("${p.id}")'>${p.name}</li>\n`;
			}

			if (p.children && p.children.length != 0) {
				let style = "";
				if (depth == 0) {
					style += "padding-inline-start:0;"; // remove unnecessary padding from top-level <ul> element
				} else {
					style += "";
				}
				let classes = "";
				if (depth >= 1)
					classes = "class='hidden'";
				self += indentDepth + `<ul id='children-${p.id}' ${classes} style='${style}'>\n`;
				for (let c of p.children)
					self += makeHTML(c, depth + 1);
				self += indentDepth + '</ul>\n';
			}
			return self;
		}

		let tree = JSON.parse(fs.readFileSync(mergedManifestFile, { encoding: "utf-8" }));
		normalizeTree(tree);

		//let frameGlobals = {
		//	s3bucket: deployParams.s3bucket || '',
		//	s3root: deployParams.s3root || '',
		//};
		//let frameGlobalsStr = "window.ssmd = " + JSON.stringify(frameGlobals) + ";";
		let frameGlobalsStr = "window.ssmd = {};";

		let listHTML = makeHTML(tree, 0);
		//list = "<ul>\n" + list + "</ul>\n";
		let frame = this.frame;
		frame = frame.replace("<!-- INDEX -->", listHTML);
		frame = frame.replace("INITIAL_PAGE", this.firstPage(tree).path);
		frame = frame.replace("/*FRAME_CSS*/", this.indexCSS);
		frame = frame.replace("/*FRAME_SCRIPT_GLOBALS*/", frameGlobalsStr);
		frame = frame.replace("/*FRAME_SCRIPT*/", this.indexJS);
		frame = frame.replace("/*PAGE_TREE*/", "var pageTree = " + JSON.stringify(tree, null, 3) + ";");
		return frame;
	}
}

// ensure that all nodes have the properties that we expect
function normalizeTree(node) {
	if (node.children === undefined)
		node.children = [];
	for (let c of node.children)
		normalizeTree(c);
}

function loadTreeOfMarkdownFiles(parentPath, parentPathRootIndex, dir) {
	let myPath = parentPath;
	if (dir != "") {
		// This is the usual case. The only case where dir = "" is for the root object
		myPath = parentPath.concat(dir);
	}
	let root = new Page();
	root.name = dir;
	root.path = parentPath.slice(parentPathRootIndex); // slice off the first part, which is the root 'content' directory
	for (var f of fs.readdirSync(myPath.join("/"))) {
		let st = fs.statSync(myPath.concat(f).join("/"));
		if (st.isDirectory()) {
			root.children.push(loadTreeOfMarkdownFiles(myPath, parentPathRootIndex, f));
		} else if (st.isFile()) {
			if (f.match(/\.md$/)) {
				let p = new Page();
				p.name = f.substr(0, f.length - 3);
				p.markdown = fs.readFileSync(myPath.concat(f).join("/"), { encoding: "utf-8" });
				p.path = myPath.slice(parentPathRootIndex);
				root.children.push(p);
			}
		}
	}
	root.promoteIndex();
	return root;
}

function childByID(node, id) {
	if (!node.children)
		return null;
	for (let c of node.children) {
		if (c.id == id)
			return c;
	}
	return null;
}

function mergeNode(dst, src) {
	for (let key of Object.keys(src)) {
		if (key == 'children')
			continue;
		if (dst[key] === undefined || dst[key] === null || dst[key] === '')
			dst[key] = src[key];
	}
}

// merge srcRoot into dstRoot
function mergeTree(dstRoot, srcRoot) {
	mergeNode(dstRoot, srcRoot);
	if (srcRoot.children) {
		for (let srcChild of srcRoot.children) {
			let dstChild = childByID(dstRoot, srcChild.id);
			if (!dstChild) {
				dstChild = {};
				if (dstRoot.children === undefined)
					dstRoot.children = [];
				dstRoot.children.push(dstChild);
			}
			mergeTree(dstChild, srcChild);
		}
	}
}

function createMergedManifest(mergedFilename, tmpDir, newManifestFile) {
	let docs = {};
	let tmpManifestDir = tmpDir + "/manifest";
	for (var f of fs.readdirSync(tmpManifestDir)) {
		let fname = tmpManifestDir + "/" + f;
		let st = fs.statSync(fname);
		if (st.isFile() && f.match(/\.json$/))
			docs[fname] = JSON.parse(fs.readFileSync(fname, { encoding: "utf-8" }));
	}
	docs[newManifestFile] = JSON.parse(fs.readFileSync(newManifestFile, { encoding: "utf-8" }));

	// sort manifests, so that we always get the same order, regardless of the filesystem.
	let manifestNames = Object.keys(docs);
	manifestNames.sort();

	let merged = {};
	for (let mft of manifestNames)
		mergeTree(merged, docs[mft]);

	fs.writeFileSync(mergedFilename, JSON.stringify(merged, null, 3));
}

function rmdirRecursive(dir) {
	if (!fs.existsSync(dir))
		return;
	for (let f of fs.readdirSync(dir)) {
		let full = dir + "/" + f;
		let st = fs.statSync(full);
		if (st.isFile()) {
			fs.unlinkSync(full);
		} else {
			rmdirRecursive(full);
		}
	}
	fs.rmdirSync(dir);
}

function writeTreeRecursive(outDir, pageBuilder, page) {
	if (page.markdown != "") {
		let filename = outDir.concat(page.name + ".html").join("/");
		let html = pageBuilder.makePage(marked(page.markdown));
		fs.writeFileSync(filename, html);
	}

	if (page.children.length != 0) {
		if (page.name != "")
			fs.mkdirSync(outDir.concat(page.name).join("/"));
		for (var c of page.children)
			writeTreeRecursive(outDir.concat(page.name), pageBuilder, c);
	}
}

function mkdirRobust(dir) {
	// sometimes the mkdir fails on Windows. This loop seems to work around the issue
	let attempts = 10;
	for (let i = 0; i < attempts; i++) {
		try {
			fs.mkdirSync(dir);
			break;
		} catch (e) {
			if (i == attempts - 1)
				throw e;
		}
	}
}

function manifestFilename(outDir, moduleName) {
	return outDir + "/manifest/" + moduleName + ".json";
}

function writeTree(outDir, moduleName, deployParams, pageBuilder, root) {
	writeTreeRecursive([outDir], pageBuilder, root);
	//fs.writeFileSync(manifestFilename(outDir, moduleName), JSON.stringify(root.makeJSONPageTree(), null, 3));
	//fs.writeFileSync(outDir + "/index.html", pageBuilder.makeIndexFrame(root, moduleName, deployParams));
}


args.option('s3id', 'S3 Access ID');
args.option('s3key', 'S3 Secret Key');
args.option('s3bucket', 'S3 Bucket Name (eg docs.example.com)');
args.option('s3root', 'S3 Root directory inside bucket (eg /ssmd)', '');
args.option('module', 'Name of this module, if this is a multi-repo document store', singleModule);
args.option('dryrun', 'Do not actually upload', false);
args.option('content', 'Content directory', 'content');
const flags = args.parse(process.argv);

// Ensure s3root has the form "foo/bar/" (always trailing slash, never leading slash)
let s3root = flags.s3root;
if (s3root.length != 0 && s3root[0] == '/')
	s3root = s3root.substr(1);
if (s3root.length != 0 && s3root[s3root.length - 1] != '/')
	s3root += '/';

async function run() {

	let deployParams = {
		s3bucket: flags.s3bucket,
		s3root: s3root,
	};

	let dist = 'dist';
	let tmp = 'tmp';
	rmdirRecursive(dist);
	rmdirRecursive(tmp);
	mkdirRobust(dist);
	mkdirRobust(tmp);
	mkdirRobust(dist + '/manifest');
	mkdirRobust(tmp + '/manifest');

	let up = null;
	if (flags.s3id && flags.s3key && flags.s3bucket) {
		up = new uploader({
			s3: {
				accessKeyId: flags.s3id,
				secretAccessKey: flags.s3key,
				bucket: flags.s3bucket,
				bucketRoot: s3root,
			},
			dist: dist,
			moduleName: flags.module,
		});
	}

	let root = loadTreeOfMarkdownFiles([flags.content], 1, ""); // a root index of 1 skips "content"

	// Write our content into dist
	let pageBuilder = new PageBuilder();
	pageBuilder.readTheme("default");
	writeTree(dist, flags.module, deployParams, pageBuilder, root);

	// Produce the merged manifest
	let merged = '';
	if (up && flags.module != singleModule) {
		try {
			// Write the manifest for this repo into /manifest/<module>.json
			// We need this on disk, so that it will get included with the upload, so that other
			// builders will incorporate it if/when they perform a manifest merge.
			let local = manifestFilename(dist, flags.module);
			merged = dist + '/manifest/_merged.json';
			fs.writeFileSync(local, JSON.stringify(root.makeJSONPageTree(), null, 3));
			await up.downloadAllManifests(tmp);
			createMergedManifest(merged, tmp, local);
			console.log("Downloaded merged manifest");
		} catch (err) {
			console.error(err);
		}
	} else {
		// just do single manifest, because we're either operating offline, or this is not a multi-module doc store
		merged = manifestFilename(dist, singleModule);
		fs.writeFileSync(merged, JSON.stringify(root.makeJSONPageTree(), null, 3));
	}
	console.info("Generated content in 'dist'");

	// create index.html
	fs.writeFileSync(dist + "/index.html", pageBuilder.makeIndexFrame(merged));

	if (up) {
		if (!flags.dryrun) {
			console.info("Uploading...");
			up.upload();
		}
	} else {
		console.info("No S3 details provided; skipping upload");
		console.info("You can preview the site in " + dist + "/index.html");
	}
}

run().catch((err) => { console.error(err) });

// for unit tests
module.exports = {
	mergeTree
}
