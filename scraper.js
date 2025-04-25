const fs = require('fs');
const puppeteer = require('puppeteer');

const baseUrls = [
  'https://help.solidworks.com/2025/english/api/swconst/SolidWorks.Interop.swconst~SolidWorks.Interop.swconst_namespace.html?id=4c923420736a49a98458345fd708984e#Pg0',
  'https://help.solidworks.com/2025/english/api/swdocmgrapi/SolidWorks.Interop.swdocumentmgr~SolidWorks.Interop.swdocumentmgr_namespace.html?id=4044b78005984a01922553042935a3bc#Pg0',
  'https://help.solidworks.com/2025/english/api/sldworksapi/SolidWorks.Interop.sldworks~SolidWorks.Interop.sldworks_namespace.html?id=f8d6d8535f3a49e7ad0538d96c234df8#Pg0'
];

const scrapedData = [];
const visitedUrls = new Set();
const sleep = ms => new Promise(res => setTimeout(res, ms));

async function extractDetails(page, url) {
  const data = { url, remarks: '', accessors: [], examples: [] };

  try {
    data.remarks = await page.$eval('#remarksSection', el => el.innerText.trim());
  } catch {}

  try {
    data.accessors = await page.$$eval('#accessorsSection a', links =>
      links.map(link => ({ name: link.textContent.trim(), url: link.href }))
    );
  } catch {}

  try {
    const exampleLinks = await page.$$eval('#examplesSection a', links =>
      links.map(link => link.href)
    );

    const exampleData = await Promise.all(
      exampleLinks.map(async (exUrl) => {
        const exPage = await page.browser().newPage();
        try {
          await exPage.goto(exUrl, { waitUntil: 'domcontentloaded' });
          const code = await exPage.$eval('pre', pre => pre.innerText.trim());
          const title = await exPage.title();
          return { title, example_code: code };
        } catch {
          return null;
        } finally {
          await exPage.close();
        }
      })
    );

    data.examples = exampleData.filter(Boolean);
  } catch {}

  return data;
}

async function scrapeUrl(browser, url) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await sleep(1000);

  await page.evaluate(() => {
    const btn = document.querySelector('tc-consent')?.shadowRoot?.querySelector('button#footer_tc_privacy_button');
    if (btn) btn.click();
  });

  let links = [];
  if (url.includes('swconst')) {
    try {
      links = await page.$$eval('#enumerationSection a', anchors => anchors.map(a => a.href));
    } catch {}
  } else {
    try {
      links = await page.$$eval('#interfaceSection a', anchors => anchors.map(a => a.href));
    } catch {}
  }

  await page.close();

  const subPages = [...new Set(links.filter(link => !visitedUrls.has(link)))];
  subPages.forEach(link => visitedUrls.add(link));

  return subPages;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1280,800']
  });

  const allLinks = await Promise.all(baseUrls.map(url => scrapeUrl(browser, url)));
  const flatLinks = allLinks.flat();

  const detailPages = await Promise.all(
    flatLinks.map(async (link) => {
      const detailPage = await browser.newPage();
      try {
        await detailPage.goto(link, { waitUntil: 'domcontentloaded' });
        const data = await extractDetails(detailPage, link);
        return data;
      } catch {
        return null;
      } finally {
        await detailPage.close();
      }
    })
  );

  scrapedData.push(...detailPages.filter(Boolean));
  await browser.close();

  fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
})();
