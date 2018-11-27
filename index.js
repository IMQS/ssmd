'use strict';
const fs = require('fs');
const marked = require('marked');

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
				name: page.name,
			};
			node.children = [];
			for (let c of page.children)
				node.children.push(make(c));
			return node;
		};
		return make(this);
	}
}

class Theme {
	constructor() {
		this.page = "";
		this.frame = "";
	}

	read(themeName) {
		this.page = fs.readFileSync("themes/" + themeName + "/page.html", {encoding: "utf-8"});
		this.frame = fs.readFileSync("themes/frame.html", {encoding: "utf-8"});
	}

	makePage(content) {
		return this.page.replace("<!-- PAGE BODY -->", content);
	}

	firstPage(page) {
		if (page.markdown != "")
			return page;
		for (let c of page.children) {
			let p = this.firstPage(c);
			if (p)
				return p;
		}
		return null;
	}

	makeFrame(tree) {
		let indent = ' '.repeat(4);
		let make = (p, depth) => {
			let self = "";
			let indentDepth = indent.repeat(depth + 1);
			if (p.markdown !== "") {
				let title = p.name;
				let classes = 'indexItem';
				if (p.children.length == 0)
					classes += " liNone";
				self += indentDepth + `<li id='doc-${p.id()}' class='${classes}' onclick='navigateToPage("${p.localUrl()}", "${p.id()}")'>${title}</li>\n`;
			} else if (p.name !== "") {
				// This is just a category node, without any content. So this might be something like "API", or "Reference".
				self += indentDepth + `<li id='doc-${p.id()}' class='indexItem' onclick='togglePageOpen("${p.id()}")'>${p.name}</li>\n`;
			}

			if (p.children.length != 0) {
				let style = "";
				if (depth == 0) {
					style += "padding-inline-start:0;"; // remove unnecessary padding from top-level <ul> element
				} else {
					style += "";
				}
				let classes = "";
				if (depth >= 1)
					classes = "class='hidden'";
				self += indentDepth + `<ul id='children-${p.id()}' ${classes} style='${style}'>\n`;
				for (let c of p.children)
					self += make(c, depth + 1);
				self += indentDepth + '</ul>\n';
			}
			return self;
		}
		let list = make(tree, 0);
		//list = "<ul>\n" + list + "</ul>\n";
		let frame = this.frame;
		frame = frame.replace("<!-- INDEX -->", list);
		frame = frame.replace("INITIAL_PAGE", this.firstPage(tree).localUrl());
		frame = frame.replace("/*PAGE_TREE*/", "let pageTree = " + JSON.stringify(tree.makeJSONPageTree(), null, 2) + ";");
		return frame;
	}
}

function readTree(parentPath, parentPathRootIndex, dir) {
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
			root.children.push(readTree(myPath, parentPathRootIndex, f));
		} else if (st.isFile()) {
			if (f.match(/\.md$/)) {
				let p = new Page();
				p.name = f.substr(0, f.length - 3);
				p.markdown = fs.readFileSync(myPath.concat(f).join("/"), {encoding: "utf-8"});
				p.path = myPath.slice(parentPathRootIndex);
				root.children.push(p);
			}
		}
	}
	root.promoteIndex();
	return root;
}

function rmdirRecursive(dir) {
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

function writeTreeRecursive(outDir, theme, page) {
	if (page.markdown != "") {
		let filename = outDir.concat(page.name + ".html").join("/");
		let html = theme.makePage(marked(page.markdown));
		fs.writeFileSync(filename, html);
	}

	if (page.children.length != 0) {
		if (page.name != "")
			fs.mkdirSync(outDir.concat(page.name).join("/"));
		for (var c of page.children)
			writeTreeRecursive(outDir.concat(page.name), theme, c);
	}
}

function writeTree(theme, page) {
	let outDir = "dist";
	if (fs.existsSync(outDir))
		rmdirRecursive(outDir);
	// sometimes the mkdir fails on Windows. This loop seems to work around the issue
	let attempts = 10;
	for (let i = 0; i < attempts; i++) {
		try {
			fs.mkdirSync(outDir);
			break;
		} catch (e) {
			if (i == attempts - 1)
				throw e;
		}
	}
	writeTreeRecursive([outDir], theme, page);
	fs.writeFileSync(outDir + "/index.html", theme.makeFrame(page));
}

let theme = new Theme();
theme.read("default");
let root = readTree(["content"], 1, ""); // a root index of 1 skips "content"
//root.dump(0);
writeTree(theme, root);



