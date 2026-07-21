import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE = 'https://robertsspaceindustries.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

async function getPage(url: string) {
  const r = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 });
  return cheerio.load(r.data as string);
}

async function main() {
  console.log('=== Fetching FRINAUTS members ===');
  const $ = await getPage(BASE + '/orgs/FRINAUTS/members');

  const members: string[] = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/\/citizens\/([A-Za-z0-9_-]+)$/);
    if (m && m[1] && !members.includes(m[1])) members.push(m[1]);
  });

  console.log(`Members found: ${members.length}`);
  members.forEach(h => console.log(`  ${h}`));

  // Get orgs for each member (with rate limiting)
  for (const handle of members) {
    await new Promise(r => setTimeout(r, 2000));
    console.log(`\nOrgs for ${handle}:`);
    try {
      const $u = await getPage(`${BASE}/citizens/${handle}/organizations`);
      const orgs: string[] = [];
      $u('a').each((_, el) => {
        const href = $u(el).attr('href') || '';
        const m2 = href.match(/\/orgs\/([A-Z0-9]+)$/);
        if (m2 && m2[1] && !orgs.includes(m2[1]) && m2[1] !== 'create') {
          orgs.push(m2[1]);
        }
      });
      if (orgs.length > 0) {
        orgs.forEach(o => console.log(`  - ${o}`));
      } else {
        console.log('  (none found or profile hidden)');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  Error: ${msg}`);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
