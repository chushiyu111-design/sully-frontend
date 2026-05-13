const fs = require('fs');
let content = fs.readFileSync('utils/chatParser.ts', 'utf8');

content = content.replace(
  /if \(content\.includes\('\[\[ACTION:POKE\]\]'\)\) \{[\s\S]*?content = content\.replace\('\[\[ACTION:POKE\]\]', ''\)\.trim\(\);\s*\}/,
  \const pokeMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()(?:ACTION\\\\s*[:：]\\\\s*)?POKE(?:\\\\]{1,2}|】|\\\\))/i);
        if (pokeMatch) {
            await DB.saveMessage({ charId, role: 'assistant', type: 'interaction', content: '[戳一戳]' });
            content = content.replace(pokeMatch[0], '').trim();
        }\
);

content = content.replace(
  /const transferMatch = content\.match\(\/\\\[\\\[ACTION:TRANSFER:\(\\d\+\)\\\]\\\]\/\);\s*if \(transferMatch\) \{[\s\S]*?content = content\.replace\(transferMatch\[0\], ''\)\.trim\(\);\s*\}/,
  \const transferMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()ACTION\\\\s*[:：]\\\\s*TRANSFER\\\\s*[:：]\\\\s*(\\\\d+)(?:\\\\]{1,2}|】|\\\\))/i);
        if (transferMatch) {
            await DB.saveMessage({ charId, role: 'assistant', type: 'transfer', content: '[转账]', metadata: { amount: transferMatch[1], status: 'pending' } });
            content = content.replace(transferMatch[0], '').trim();
        }\
);

content = content.replace(
  /if \(content\.includes\('\[\[ACTION:RECEIVE_TRANSFER\]\]'\)\) \{[\s\S]*?content = content\.replace\('\[\[ACTION:RECEIVE_TRANSFER\]\]', ''\)\.trim\(\);\s*\}/,
  \const receiveTransferMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()ACTION\\\\s*[:：]\\\\s*RECEIVE_TRANSFER(?:\\\\]{1,2}|】|\\\\))/i);
        if (receiveTransferMatch) {
            try {
                const recentMsgs = await DB.getRecentMessagesByCharId(charId, 50);
                const pendingUserTransfer = recentMsgs.slice().reverse().find(
                    m => m.role === 'user' && m.type === 'transfer' && m.metadata?.status === 'pending'
                );
                if (pendingUserTransfer) {
                    await DB.updateMessageMetadata(pendingUserTransfer.id, { status: 'accepted' });
                    addToast(\\\\ 已收取 ¥\\\\, 'success');
                }
            } catch (e) { console.error('RECEIVE_TRANSFER failed:', e); }
            content = content.replace(receiveTransferMatch[0], '').trim();
        }\
);

content = content.replace(
  /if \(content\.includes\('\[\[ACTION:RETURN_TRANSFER\]\]'\)\) \{[\s\S]*?content = content\.replace\('\[\[ACTION:RETURN_TRANSFER\]\]', ''\)\.trim\(\);\s*\}/,
  \const returnTransferMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()ACTION\\\\s*[:：]\\\\s*RETURN_TRANSFER(?:\\\\]{1,2}|】|\\\\))/i);
        if (returnTransferMatch) {
            try {
                const recentMsgs = await DB.getRecentMessagesByCharId(charId, 50);
                const pendingUserTransfer = recentMsgs.slice().reverse().find(
                    m => m.role === 'user' && m.type === 'transfer' && m.metadata?.status === 'pending'
                );
                if (pendingUserTransfer) {
                    await DB.updateMessageMetadata(pendingUserTransfer.id, { status: 'returned' });
                    addToast(\\\\ 退还了 ¥\\\\, 'info');
                }
            } catch (e) { console.error('RETURN_TRANSFER failed:', e); }
            content = content.replace(returnTransferMatch[0], '').trim();
        }\
);

content = content.replace(
  /const eventMatch = content\.match\(\/\\\[\\\[ACTION:ADD_EVENT\\\\s\*\\\|\\\\s\*\(\.\*\?\)\\\\s\*\\\|\\\\s\*\(\.\*\?\)\\\]\\\]\/\);\s*if \(eventMatch\) \{[\s\S]*?content = content\.replace\(eventMatch\[0\], ''\)\.trim\(\);\s*\}/,
  \const eventMatch = content.match(/(?:\\\\[{1,2}|【|\\\\()ACTION\\\\s*[:：]\\\\s*ADD_EVENT\\\\s*[|｜]\\\\s*(.*?)\\\\s*[|｜]\\\\s*(.*?)(?:\\\\]{1,2}|】|\\\\))/i);
        if (eventMatch) {
            const title = eventMatch[1].trim();
            const date = eventMatch[2].trim();
            if (title && date) {
                const anni = { id: \\\nni-\\\\, title: title, date: date, charId };
                await DB.saveAnniversary(anni);
                addToast(\\\\ 添加了新日程: \\\\, 'success');
                await DB.saveMessage({ charId, role: 'system', type: 'text', content: \\\[系统: \ 新增了日程 "\" (\)]\\\, metadata: { source: 'schedule', scheduleEvent: 'add_event' } });
            }
            content = content.replace(eventMatch[0], '').trim();
        }\
);

fs.writeFileSync('utils/chatParser.ts', content, 'utf8');
console.log('Done!');
