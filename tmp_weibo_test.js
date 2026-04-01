import https from 'node:https';

async function fetchWeibo(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // 'Cookie': 'SUB=_2AkMUy18Ff8NxqwJRmP8dyGPmb49wzwvEieKnc0lJJRMxHRl-yT9kqmEMtRB6PshqC7t5Yq-jP0z4Rz9D_-eC0_dof5Z2;'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function test() {
    console.log("Testing s.weibo.com HTML ent...");
    try {
        const entUrl = 'https://s.weibo.com/top/summary?cate=ent';
        const res = await fetch(entUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                // Important for s.weibo to not redirect to passport
                'Cookie': 'SUB=_2AkMUy18Ff8NxqwJRmP8dyGPmb49wzwvEieKnc0lJJRMxHRl-yT9kqmEMtRB6PshqC7t5Yq-jP0z4Rz9D_-eC0_dof5Z2;'
            }
        });
        const html = await res.text();
        const matches = [];
        const regex = /<td class="td-02">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/td>/g;
        let m;
        while ((m = regex.exec(html)) !== null) {
            let title = m[2].replace(/\n/g, '').trim();
            // Try to extract heat from m[3] if it exists
            let heat = 0;
            const heatMatch = m[3].match(/<span>(\d+)<\/span>/);
            if (heatMatch) heat = parseInt(heatMatch[1], 10);
            
            // Try to extract tag
            let tag = '';
            if (m[3].includes('icon-txt-hot')) tag = '热';
            else if (m[3].includes('icon-txt-new')) tag = '新';
            else if (m[3].includes('icon-txt-boil')) tag = '沸';
            else if (m[3].includes('icon-txt-fei')) tag = '沸';
            else if (m[3].includes('icon-txt-jian')) tag = '荐';
            
            matches.push({ title, hot: heat, tag });
        }
        console.log("Found matches:", matches.length);
        if (matches.length > 0) {
            console.log("Top 5:", matches.slice(0, 5));
        }
    } catch(e) {
        console.error("Fetch failed:", e.message);
    }
}

test();
