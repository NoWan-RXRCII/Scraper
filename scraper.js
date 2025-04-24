const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

// The base URLs you provided (these should not be changed)
const baseUrls = [
  'https://help.solidworks.com/2025/english/api/swconst/SolidWorks.Interop.swconst~SolidWorks.Interop.swconst_namespace.html?id=4c923420736a49a98458345fd708984e#Pg0',
  'https://help.solidworks.com/2025/english/api/swdocmgrapi/SolidWorks.Interop.swdocumentmgr~SolidWorks.Interop.swdocumentmgr_namespace.html?id=4044b78005984a01922553042935a3bc#Pg0',
  'https://help.solidworks.com/2025/english/api/sldworksapi/SolidWorks.Interop.sldworks~SolidWorks.Interop.sldworks_namespace.html?id=f8d6d8535f3a49e7ad0538d96c234df8#Pg0'
];

const scrapedData = [];
const visitedUrls = new Set();
const exampleLinks = new Set();  // Prevent re-scraping examples

// Function to scrape a page
async function scrapePage(url, currentDepth, maxDepth) {
  if (visitedUrls.has(url)) return;
  console.log(`Scraping (depth ${currentDepth}): ${url}`);
  visitedUrls.add(url);

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // --- Scrape Depth 0 (Directory Page) ---
    if (currentDepth === 0) {
      let linksSelector;
      if (url.includes('swconst')) {
        linksSelector = '#enumerationSection a';
      } else {
        linksSelector = '#interfaceSection a';
      }

      // Extract links from the selected section
      const links = await page.$$eval(linksSelector, (anchors) => {
        return anchors.map(anchor => anchor.href).filter(href => href.includes('SolidWorks.Interop'));
      });

      // Process each link
      for (let link of links) {
        if (!visitedUrls.has(link)) {
          visitedUrls.add(link);
          if (currentDepth < maxDepth) {
            await scrapePage(link, currentDepth + 1, maxDepth);  // Follow the link to Depth 1 page
          }
        }
      }
    }

    // --- Scrape Depth 1 (Interface Page) ---
    if (currentDepth === 1) {
      const pageData = {
        url,
        remarks: "",
        accessors: [],
        examples: [],
        see_also: [],
      };

      // Extract remarks if available
      const remarks = await page.$eval('#remarksSection', (section) => section ? section.innerText : '');
      if (remarks) {
        pageData.remarks = remarks.trim();
      }

      // Extract accessors if available
      const accessors = await page.$$eval('#accessorsSection a', (links) => {
        return links.map(link => {
          const accessorUrl = link.href.startsWith('http') ? link.href : `https://help.solidworks.com${link.href}`;
          return { name: link.textContent, url: accessorUrl };
        });
      });
      pageData.accessors = accessors;

      // Extract example code if available
      const examples = await page.$$eval('pre', (codeBlocks) => {
        return codeBlocks.map((block, index) => ({
          title: block.previousElementSibling ? block.previousElementSibling.innerText : `Example ${index + 1}`,
          example_code: block.innerText.trim(),
        }));
      });
      pageData.examples = examples;

      // Collect "See Also" links
      const seeAlsoLinks = await page.$$eval('#seeAlsoSection a', (links) => {
        return links.map(link => {
          const seeAlsoUrl = link.href.startsWith('http') ? link.href : `https://help.solidworks.com${link.href}`;
          return seeAlsoUrl;
        });
      });
      pageData.see_also = seeAlsoLinks;

      console.log(`Collected Data: ${JSON.stringify(pageData, null, 2)}`);
      scrapedData.push(pageData);
    }

    await browser.close();
  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
  }
}

// Start scraping all the base URLs
(async () => {
  const maxDepth = 2;  // Max depth to scrape, including directory and interface pages

  for (let baseUrl of baseUrls) {
    await scrapePage(baseUrl, 0, maxDepth);  // Start at Depth 0
  }

  // Check if scraped data is being populated
  console.log('Scraping complete. Scraped data:', scrapedData);

  // Save the scraped data to a JSON file
  fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
  console.log('Data saved to scrapedData.json');

  // Commit and push the scraped data to GitHub
  try {
    execSync('git config --global user.name "github-actions[bot]"');
    execSync('git config --global user.email "github-actions[bot]@users.noreply.github.com"');
    
    // Stage the changes
    execSync('git add scrapedData.json');

    // Commit only if there are changes
    const commitMessage = 'chore: update scraped data';
    execSync(`git commit -m "${commitMessage}"`);

    // Pull to ensure we're up-to-date with the remote
    execSync('git pull --rebase origin main');
    
    // Push the changes
    execSync('git push origin HEAD:main');

    console.log('Commit and push successful!');
  } catch (error) {
    console.error('Error during git commit and push:', error.message);
  }
})();
