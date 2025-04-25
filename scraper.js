async function scrapeUrl(browser, url) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  let interfaceLinks = [];
  let enumLinks = [];
  let syntaxText = '';
  let members = [];
  let examples = [];
  let accessors = [];

  // Depth 0: Scrape Interface and Enumeration sections if they exist
  try {
    const interfaceSection = await page.$('#interfaceSection');
    if (interfaceSection) {
      interfaceLinks = await page.$$eval('#interfaceSection .LinkCell', rows => {
        return rows.map(row => {
          const link = row.querySelector('a');
          const description = row.querySelector('.DescriptionCell');
          return {
            name: link ? link.innerText.trim() : '',
            url: link ? link.href : '',
            description: description ? description.innerText.trim() : ''
          };
        });
      });
    }
  } catch (err) {
    console.error(`Error extracting interface section: ${err.message}`);
  }

  try {
    const enumSection = await page.$('#enumerationSection');
    if (enumSection) {
      enumLinks = await page.$$eval('#enumerationSection .LinkCell', rows => {
        return rows.map(row => {
          const link = row.querySelector('a');
          const description = row.querySelector('.DescriptionCell');
          return {
            name: link ? link.innerText.trim() : '',
            url: link ? link.href : '',
            description: description ? description.innerText.trim() : ''
          };
        });
      });
    }
  } catch (err) {
    console.error(`Error extracting enumeration section: ${err.message}`);
  }

  // Depth 1: Scrape Syntax Section if it exists
  try {
    const syntaxSection = await page.$('#syntaxSection');
    if (syntaxSection) {
      syntaxText = await page.$eval('#syntaxSection', el => el.innerText.trim());
    }
  } catch (err) {
    console.error(`Error extracting syntax section: ${err.message}`);
  }

  // Depth 1: Scrape Members Section if it exists
  try {
    const membersSection = await page.$('#membersSection');
    if (membersSection) {
      members = await page.$$eval('#membersSection .memberRow', rows => {
        return rows.map(row => {
          const memberName = row.querySelector('.memberName');
          const memberDescription = row.querySelector('.memberDescription');
          return {
            name: memberName ? memberName.innerText.trim() : 'Member',
            description: memberDescription ? memberDescription.innerText.trim() : ''
          };
        });
      });
    }
  } catch (err) {
    console.error(`Error extracting members section: ${err.message}`);
  }

  // Depth 1: Scrape Example Section if it exists (Links to Depth 2)
  try {
    const exampleSection = await page.$('#exampleSection');
    if (exampleSection) {
      examples = await page.$$eval('#exampleSection a', links => links.map(link => ({
        title: link.innerText.trim(),
        url: link.href
      })));
    }
  } catch (err) {
    console.error(`Error extracting example section: ${err.message}`);
  }

  // Depth 1: Scrape Accessor Section if it exists (Links to Depth 2)
  try {
    const accessorSection = await page.$('#accessorSection');
    if (accessorSection) {
      accessors = await page.$$eval('#accessorSection a', links => links.map(link => ({
        name: link.innerText.trim(),
        url: link.href
      })));
    }
  } catch (err) {
    console.error(`Error extracting accessor section: ${err.message}`);
  }

  // Follow the links in the Example Section (Depth 2) and scrape the example code
  for (const example of examples) {
    const examplePageData = await scrapeExamplePage(page, example.url);
    examples.push(examplePageData); // Append the example data to the array
  }

  // Follow the links in the Accessor Section (Depth 2) and scrape the syntax
  for (const accessor of accessors) {
    const accessorPageData = await scrapeAccessorPage(page, accessor.url);
    accessors.push(accessorPageData); // Append the accessor data to the array
  }

  // Log the extracted data for Depth 0 and Depth 1
  console.log("Extracted interface links and descriptions:", interfaceLinks);
  console.log("Extracted enumeration links and descriptions:", enumLinks);
  console.log("Extracted syntax text:", syntaxText);
  console.log("Extracted members data:", members);
  console.log("Extracted examples:", examples);
  console.log("Extracted accessors:", accessors);

  await page.close();
  return {
    interfaceLinks,
    enumLinks,
    syntaxText,
    members,
    examples,
    accessors
  };
}

// Depth 2: Scrape the example code from the linked page (from Example Section)
async function scrapeExamplePage(page, url) {
  const data = { url, codeExamples: [] };

  try {
    // Scrape the code example from the page
    const code = await page.$$eval('div, p', blocks => {
      return blocks.filter(block => block.textContent.includes('using') || block.textContent.includes('public class')).map(block => block.innerText.trim());
    });

    if (code.length > 0) {
      data.codeExamples = code;
    } else {
      console.warn(`No example code found on ${url}`);
    }
  } catch (err) {
    console.error(`Error extracting code from example page ${url}: ${err.message}`);
  }

  return data;
}

// Depth 2: Scrape the accessor syntax from the linked page (from Accessor Section)
async function scrapeAccessorPage(page, url) {
  const data = { url, accessorSyntax: '' };

  try {
    // Extract the syntax for the accessor (from the page)
    const syntax = await page.$eval('#syntaxSection', el => el.innerText.trim());
    data.accessorSyntax = syntax;
  } catch (err) {
    console.error(`Error extracting accessor syntax from ${url}: ${err.message}`);
  }

  return data;
}
