# Super Simple Markdown Docs

Super Simple Markdown Docs is *the simplest* way to create documentation.
If you know markdown, and you can create a file, you already know how to use it.

1. Create your documentation hierarchy of `.md` files:
<pre>
docsrc/
|-- Service Foo/
|   |-- index.md
|   |-- API.md
|   |-- How to use.md
|-- Other things/
|   |-- Subfolder A/
|   |   |-- index.md
|   |   |-- topic 1.md
|   |   |-- topic 2.md
|   |-- Subfolder B/
|   |   |-- topic 3.md
|   |   |-- topic 4.md
</pre>

2. Run `node ssmd.js --content=docsrc --s3bucket=docs.example.com --s3id=ABC123 --s3key=secretkey`
3. *Alternatively,* if you don't want to publish to S3, then just publish the static HTML files that are generated inside `dist` to a static file hoster of your choice.

The ONLY thing you need to do, is create your markdown files, and place them in a file hierarchy.

**No index files** to maintain.  
**No navbar files** to maintain.  
**Just markdown files** in a **directory tree**.

## Extra Features
* **Merge Multiple Repos:** For large projects, you can maintain your documentation trees in different git repos. `ssmd` is capable of merging together different trees, without any special coordination on your part. It's as though all the directory trees are merged before generating the HTML. No need to coordinate your CI jobs. Every repo can merge and upload it's contents independently. You must use the S3 uploader in order for this to work.
* **Syntax highlighting** of source code blocks
* Automatic detection of **HTTP API** documentation, with nice formatting.

## Rules
* Create an `index.md` file to create content for a directory. If you don't create an `index.md` file, then the directory will just be a node in the tree, but it won't have any content.
* To create HTTP API documentation, name the file `API.md`. Then, create an API entry point by creating an *h1* item in markdown, that starts with the HTTP method of the API, for example: `# POST /path/to/api?key=value`

## License
MIT License
