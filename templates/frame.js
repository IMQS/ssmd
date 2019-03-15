// This file is injected into index.html

function setPageOpenedStatus(id, isOpen) {
	if (isOpen)
		localStorage.setItem("opened-" + id, "1");
	else
		localStorage.removeItem("opened-" + id);
}

function getPageOpenedStatus(id) {
	return localStorage.getItem("opened-" + id) == "1";
}

function foobar(ev) {
	console.log(ev);
}

function navigateToPage(url, id) {
	// Navigate the iframe to a new location
	var content = document.getElementsByClassName('contentPane')[0];
	content.src = url;
	window.location.hash = id;
	//var page = findPageById(id);
	//if (page && page.children.length != 0) {
	//	togglePageOpen(id);
	//}
	refreshIndexVisibility(false);
}

function togglePageOpen(id) {
	setPageOpenedStatus(id, !getPageOpenedStatus(id));
	refreshIndexVisibility(false);
}

function findPageById(id) {
	var treePath = findPagePathById(id);
	if (treePath == null)
		return null;
	return treePath[treePath.length - 1];
}

// Returns an array of pages, from the root down to the desired page, or returns null if item not found
function findPagePathById(id) {
	if (id === null || id === undefined || id == "")
		return null;
	var find = function (page, _id) {
		if (page.id == _id)
			return [page];
		for (var i = 0; i < page.children.length; i++) {
			var res = find(page.children[i], _id);
			if (res !== null)
				return [page].concat(res);
		}
		return null;
	};
	return find(pageTree, id);
}

// Scans through the page tree, and returns all of them, in an array
function allPages() {
	var list = [];
	var walk = function (page) {
		list.push(page);
		for (var i = 0; i < page.children.length; i++)
			walk(page.children[i]);
	};
	walk(pageTree);
	return list;
}

// Scans through the page tree, and returns all of the pages with 1 or more children, in an array
function allPagesWithChildren() {
	var list = [];
	var walk = function (page) {
		if (page.children.length != 0) {
			// only the root page has an empty ID
			if (page.id != "")
				list.push(page);
			for (var i = 0; i < page.children.length; i++)
				walk(page.children[i]);
		}
	};
	walk(pageTree);
	return list;
}

// Collapse or show the nodes on the index tree
function refreshIndexVisibility(ensureTargetPageIsOpened) {
	// Always refresh the status of all pages that have children
	var pages = allPagesWithChildren();
	// Make sure that the tree we're currently browsed to is opened.
	// Additionally, a page can be specified as opened inside localStorage.
	var targetPageID = decodeURIComponent(window.location.hash.substr(1));
	var targetPath = findPagePathById(targetPageID);
	var targetPage = targetPath ? targetPath[targetPath.length - 1] : null;
	for (var i = 0; i < pages.length; i++) {
		var page = pages[i];
		var mustShow = getPageOpenedStatus(page.id);
		if (ensureTargetPageIsOpened && targetPath && !mustShow) {
			// why targetPath.length - 1?
			// We do this so that it's possible to collapse a node. Just because you've navigated to
			// a node with children, doesn't mean you want it's children to be open. Specifically, you
			// might navigate to such a node, and then want to close it. You'll close it by clicking on
			// it again, which keeps you navigated to that node, BUT at the same time you also want
			// it's children to be hidden.
			for (var j = 0; j < targetPath.length - 1; j++) {
				if (targetPath[j] == page) {
					mustShow = true;
					break;
				}
			}
		}
		var elChildren = document.getElementById('children-' + page.id);
		if (elChildren) {
			if (mustShow) {
				elChildren.classList.remove('hidden');
			} else {
				elChildren.classList.add('hidden');
			}
		}
		var elDoc = document.getElementById('openclose-' + page.id);
		if (elDoc) {
			if (mustShow) {
				elDoc.classList.remove('liCollapsed');
				elDoc.classList.add('liExpanded');
			} else {
				elDoc.classList.remove('liExpanded');
				elDoc.classList.add('liCollapsed');
			}
		}
	}
	// refresh the active/not active status of all pages
	var all = allPages();
	for (var i = 0; i < all.length; i++) {
		var el = document.getElementById('doc-' + all[i].id);
		if (el) {
			if (targetPage == all[i])
				el.classList.add('currentTarget');
			else
				el.classList.remove('currentTarget');
		}
	}
}

function onBodyLoad() {
	refreshIndexVisibility(true);

	// Load the correct page from the URL hash
	var id = window.location.hash;
	if (id !== '') {
		id = id.substr(1); // chop off #
		id = decodeURIComponent(id);
		var page = findPageById(id);
		if (page) {
			var content = document.getElementsByClassName('contentPane')[0];
			content.src = page.path;
		}
	}
}

