const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('dist/index.html', 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;
const element = document.querySelector('div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > span:nth-of-type(1)');
console.log(element ? element.outerHTML : "Element not found");
