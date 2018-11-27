# Super Simple Markdown Docs

Super Simple Markdown Docs aims to be the *simplest* way to create documentation.

1. Create your documentation hierarchy as `.md` files:
<pre>
content/
|-- Service Foo/
|   |-- index.md
|   |-- API.md
|   |-- How to use.md
|-- Other things/
|   |-- Subfolder A/
|   |   |-- topic 1.md
|   |   |-- topic 2.md
|   |-- Subfolder B/
|   |   |-- topic 3.md
|   |   |-- topic 4.md
</pre>

2. Run `node index.js`
3. Publish the static HTML files that are generated inside `dist`

The ONLY thing you need to do, is create your markdown files, and place them in a file hierarchy. There are no special index files that you need to maintain, or anything else like that.

## TODO
* Turn this into an npm package
* Create an example
* Add a special system to suck the index out of a markdown doc filled with API endpoints.
* Figure out how to use a CDN to get really low latency serving of statically generated docs.
* Incorporate a syntax highlighting module
* Make a theme system, which separates the Javascript from the styles
